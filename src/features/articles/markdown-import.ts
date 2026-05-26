import { ArticleStatus, ContentVisibility } from "@prisma/client";
import { marked } from "marked";
import type { CurrentUser } from "@/lib/auth";
import { isImportableImageSource, importImageSource } from "@/lib/remote-image-import";
import { createArticle } from "@/features/articles/service";

const MARKDOWN_MAX_SIZE = 2 * 1024 * 1024;
const EMPTY_EDITOR_DOC = { type: "doc", content: [] };

type ArticleImportLocale = "zh-CN" | "en-US";
type FrontMatterValue = string | string[];

type MarkdownFrontMatter = Partial<Record<
  "title" | "slug" | "summary" | "cover" | "publishedAt" | "sourceLocale" | "seoTitle" | "seoDescription" | "tags",
  FrontMatterValue
>>;

export class MarkdownImportError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = "MarkdownImportError";
  }
}

export type MarkdownImportResult = {
  article: Awaited<ReturnType<typeof createArticle>>;
  imageFailures: Array<{ src: string; message: string }>;
};

function parseScalar(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function splitInlineArray(value: string) {
  return value
    .slice(1, -1)
    .split(",")
    .map(parseScalar)
    .filter(Boolean);
}

function parseFrontMatterValue(value: string): FrontMatterValue {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return splitInlineArray(trimmed);
  }
  return parseScalar(trimmed);
}

function parseFrontMatter(markdown: string): { metadata: MarkdownFrontMatter; body: string } {
  const normalized = markdown.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { metadata: {}, body: normalized };
  }

  const closing = normalized.indexOf("\n---", 4);
  if (closing < 0) {
    return { metadata: {}, body: normalized };
  }

  const afterClosing = normalized.slice(closing).match(/^\n---[ \t]*\n?/);
  if (!afterClosing) {
    return { metadata: {}, body: normalized };
  }

  const metadata: MarkdownFrontMatter = {};
  const rawFrontMatter = normalized.slice(4, closing);
  for (const line of rawFrontMatter.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1] as keyof MarkdownFrontMatter;
    if (
      key === "title" ||
      key === "slug" ||
      key === "summary" ||
      key === "cover" ||
      key === "publishedAt" ||
      key === "sourceLocale" ||
      key === "seoTitle" ||
      key === "seoDescription" ||
      key === "tags"
    ) {
      metadata[key] = parseFrontMatterValue(match[2]);
    }
  }

  return { metadata, body: normalized.slice(closing + afterClosing[0].length) };
}

function firstString(value: FrontMatterValue | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

function stringList(value: FrontMatterValue | undefined) {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter(Boolean);
  }
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function stripInlineMarkdown(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function findFirstH1(markdown: string) {
  const lines = markdown.split("\n");
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^ {0,3}#\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) {
      return { title: stripInlineMarkdown(match[1]), lineIndex: index };
    }
  }

  return null;
}

function removeLine(markdown: string, lineIndex: number) {
  const lines = markdown.split("\n");
  lines.splice(lineIndex, 1);
  return lines.join("\n").trim();
}

function filenameTitle(filename: string) {
  return filename
    .replace(/\.(md|markdown)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

function normalizeSourceLocale(value: string, fallback: string): ArticleImportLocale {
  if (value === "zh-CN" || value === "en-US") return value;
  if (fallback === "zh-CN" || fallback === "en-US") return fallback;
  throw new MarkdownImportError("Unsupported source locale.", "fallbackSourceLocale");
}

function parsePublishedAt(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new MarkdownImportError("Published date is invalid.", "publishedAt");
  }
  return date;
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeAttribute(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function localizeHtmlImages(html: string, uploaderId: string) {
  const failures: Array<{ src: string; message: string }> = [];
  const imageSrcPattern = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(.*?)\2([^>]*?>)/gi;
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = imageSrcPattern.exec(html))) {
    result += html.slice(lastIndex, match.index);
    lastIndex = imageSrcPattern.lastIndex;

    const src = decodeAttribute(match[3].trim());
    if (!isImportableImageSource(src)) {
      result += match[0];
      continue;
    }

    try {
      const asset = await importImageSource(src, uploaderId);
      result += `${match[1]}${match[2]}${escapeAttribute(asset.url)}${match[2]}${match[4]}`;
    } catch (error) {
      failures.push({
        src,
        message: error instanceof Error ? error.message : "Image import failed."
      });
      result += match[0];
    }
  }

  result += html.slice(lastIndex);
  return { html: result, failures };
}

function validateMarkdownFile(file: unknown): asserts file is File {
  if (!(file instanceof File)) {
    throw new MarkdownImportError("Please choose a Markdown file.", "markdownFile");
  }
  if (!/\.(md|markdown)$/i.test(file.name)) {
    throw new MarkdownImportError("Only .md and .markdown files are supported.", "markdownFile");
  }
  if (file.size <= 0) {
    throw new MarkdownImportError("Markdown file is empty.", "markdownFile");
  }
  if (file.size > MARKDOWN_MAX_SIZE) {
    throw new MarkdownImportError("Markdown file cannot exceed 2 MB.", "markdownFile");
  }
}

export async function importMarkdownArticle(
  user: CurrentUser,
  input: { file: unknown; fallbackSourceLocale: string }
): Promise<MarkdownImportResult> {
  validateMarkdownFile(input.file);

  const rawMarkdown = new TextDecoder("utf-8").decode(await input.file.arrayBuffer());
  const { metadata, body } = parseFrontMatter(rawMarkdown);
  const frontMatterTitle = firstString(metadata.title);
  const firstH1 = findFirstH1(body);
  const title = frontMatterTitle || firstH1?.title || filenameTitle(input.file.name);

  if (!title) {
    throw new MarkdownImportError("Markdown title could not be detected.", "markdownFile");
  }

  const bodyMarkdown = frontMatterTitle || !firstH1 ? body.trim() : removeLine(body, firstH1.lineIndex);
  if (!bodyMarkdown.trim()) {
    throw new MarkdownImportError("Markdown file has no article body.", "markdownFile");
  }

  const renderedHtml = marked(bodyMarkdown, {
    async: false,
    breaks: false,
    gfm: true
  });
  const { html: contentHtml, failures } = await localizeHtmlImages(renderedHtml, user.id);

  const article = await createArticle(user, {
    title,
    slug: firstString(metadata.slug),
    summary: firstString(metadata.summary),
    cover: firstString(metadata.cover),
    contentJson: EMPTY_EDITOR_DOC,
    contentHtml,
    status: ArticleStatus.DRAFT,
    visibility: ContentVisibility.PUBLIC,
    allowComments: true,
    pinned: false,
    featured: false,
    seoTitle: firstString(metadata.seoTitle),
    seoDescription: firstString(metadata.seoDescription),
    sourceLocale: normalizeSourceLocale(firstString(metadata.sourceLocale), input.fallbackSourceLocale),
    publishedAt: parsePublishedAt(firstString(metadata.publishedAt)),
    tagNames: stringList(metadata.tags)
  });

  return { article, imageFailures: failures };
}
