import { Prisma, type ArticleContentBlock } from "@prisma/client";

export const LONG_ARTICLE_HTML_THRESHOLD = 350_000;
export const ARTICLE_CONTENT_BLOCK_TARGET_CHARS = 90_000;
export const ARTICLE_CONTENT_BLOCK_INITIAL_LIMIT = 2;
const ARTICLE_CONTENT_BLOCK_BATCH_SIZE = 25;

export type ArticleContentTocItem = {
  id: string;
  title: string;
  level: 1 | 2 | 3 | 4;
  blockIndex?: number;
};

export type ArticleContentBlockView = Pick<ArticleContentBlock, "blockIndex" | "html">;

export type LongArticleContentMeta = {
  kind: "article-content-blocks";
  version: 1;
  locale: "zh-CN" | "en-US";
  blockCount: number;
  htmlLength: number;
  markdownLength?: number;
  sourceFileName?: string;
  createdAt: string;
  toc: ArticleContentTocItem[];
};

type PreparedBlock = {
  blockIndex: number;
  html: string;
  textLength: number;
  anchorId: string | null;
  title: string | null;
  level: number | null;
};

export type PreparedArticleContentBlocks = {
  html: string;
  blocks: PreparedBlock[];
  toc: ArticleContentTocItem[];
};

function plainTextFromHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function slugifyHeading(value: string, fallback: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function prepareHeadingIds(html: string) {
  const toc: ArticleContentTocItem[] = [];
  const seen = new Map<string, number>();
  const nextHtml = html.replace(/<h([1-4])([^>]*)>([\s\S]*?)<\/h\1>/gi, (match, levelValue, attrs, content) => {
    const level = Number(levelValue) as 1 | 2 | 3 | 4;
    const title = plainTextFromHtml(content);

    if (!title) {
      return match;
    }

    const baseId = slugifyHeading(title, `heading-${toc.length + 1}`);
    const count = seen.get(baseId) ?? 0;
    seen.set(baseId, count + 1);
    const id = count ? `${baseId}-${count + 1}` : baseId;
    toc.push({ id, title, level });

    const cleanedAttrs = String(attrs).replace(/\s+id\s*=\s*(["']).*?\1/i, "");
    return `<h${level}${cleanedAttrs} id="${escapeAttribute(id)}">${content}</h${level}>`;
  });

  return { html: nextHtml, toc };
}

function tokenizeHtmlBlocks(html: string) {
  const tokens = (html.match(/[\s\S]*?(?:<\/(?:h[1-6]|p|blockquote|pre|table|ul|ol|details|summary|div)>|<(?:hr|br)\b[^>]*\/?>|$)/gi) ?? [])
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return tokens.length ? tokens : [html];
}

function splitHtmlIntoBlocks(html: string, targetChars = ARTICLE_CONTENT_BLOCK_TARGET_CHARS) {
  const tokens = tokenizeHtmlBlocks(html);
  const blocks: string[] = [];
  let current = "";

  for (const token of tokens) {
    if (!current) {
      current = token;
      continue;
    }

    if (current.length + token.length > targetChars) {
      blocks.push(current);
      current = token;
    } else {
      current += token;
    }
  }

  if (current) {
    blocks.push(current);
  }

  return blocks;
}

function tocItemInHtml(html: string, item: ArticleContentTocItem) {
  const escapedId = escapeAttribute(item.id);
  return html.includes(`id="${escapedId}"`) || html.includes(`id='${escapedId}'`);
}

export function shouldUseArticleContentBlocks(html: string) {
  return html.length >= LONG_ARTICLE_HTML_THRESHOLD;
}

export function prepareArticleContentBlocks(html: string): PreparedArticleContentBlocks {
  const prepared = prepareHeadingIds(html);
  const blockHtml = splitHtmlIntoBlocks(prepared.html);
  const toc = prepared.toc.map((item) => ({ ...item }));
  const blocks = blockHtml.map((block, blockIndex) => {
    const blockToc = toc.filter((item) => tocItemInHtml(block, item));
    for (const item of blockToc) {
      item.blockIndex = blockIndex;
    }
    const firstHeading = blockToc[0] ?? null;

    return {
      blockIndex,
      html: block,
      textLength: plainTextFromHtml(block).length,
      anchorId: firstHeading?.id ?? null,
      title: firstHeading?.title ?? null,
      level: firstHeading?.level ?? null
    };
  });

  return {
    html: prepared.html,
    blocks,
    toc
  };
}

export function buildLongArticleContentMeta(input: {
  locale: "zh-CN" | "en-US";
  blocks: PreparedBlock[];
  toc: ArticleContentTocItem[];
  htmlLength: number;
  markdownLength?: number;
  sourceFileName?: string;
}): LongArticleContentMeta {
  return {
    kind: "article-content-blocks",
    version: 1,
    locale: input.locale,
    blockCount: input.blocks.length,
    htmlLength: input.htmlLength,
    markdownLength: input.markdownLength,
    sourceFileName: input.sourceFileName,
    createdAt: new Date().toISOString(),
    toc: input.blocks.flatMap((block) => (
      block.anchorId && block.title && block.level && [1, 2, 3, 4].includes(block.level)
        ? [{
            id: block.anchorId,
            title: block.title,
            level: block.level as 1 | 2 | 3 | 4,
            blockIndex: block.blockIndex
          }]
        : []
    ))
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseTocItems(value: unknown): ArticleContentTocItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.id !== "string" || typeof item.title !== "string") {
      return [];
    }
    const level = Number(item.level);
    if (![1, 2, 3, 4].includes(level)) {
      return [];
    }
    const blockIndex = Number(item.blockIndex);
    return [{
      id: item.id,
      title: item.title,
      level: level as 1 | 2 | 3 | 4,
      ...(Number.isInteger(blockIndex) && blockIndex >= 0 ? { blockIndex } : {})
    }];
  });
}

export function getLongArticleContentMeta(value: unknown): LongArticleContentMeta | null {
  if (!isRecord(value)) {
    return null;
  }

  const candidate = isRecord(value.longArticleContent) ? value.longArticleContent : value;
  if (candidate.kind !== "article-content-blocks" || candidate.version !== 1) {
    return null;
  }

  const locale = candidate.locale === "en-US" ? "en-US" : "zh-CN";
  const blockCount = Number(candidate.blockCount);
  const htmlLength = Number(candidate.htmlLength);
  if (!Number.isInteger(blockCount) || blockCount <= 0 || !Number.isFinite(htmlLength)) {
    return null;
  }

  return {
    kind: "article-content-blocks",
    version: 1,
    locale,
    blockCount,
    htmlLength,
    markdownLength: Number.isFinite(Number(candidate.markdownLength)) ? Number(candidate.markdownLength) : undefined,
    sourceFileName: typeof candidate.sourceFileName === "string" ? candidate.sourceFileName : undefined,
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : "",
    toc: parseTocItems(candidate.toc)
  };
}

export function longArticleRawImportMeta(meta: LongArticleContentMeta): Prisma.InputJsonValue {
  return {
    longArticleContent: meta
  };
}

export async function replaceArticleContentBlocks(
  tx: Prisma.TransactionClient,
  articleId: string,
  locale: string,
  blocks: PreparedBlock[]
) {
  await tx.articleContentBlock.deleteMany({ where: { articleId, locale } });

  for (let index = 0; index < blocks.length; index += ARTICLE_CONTENT_BLOCK_BATCH_SIZE) {
    const batch = blocks.slice(index, index + ARTICLE_CONTENT_BLOCK_BATCH_SIZE);
    await tx.articleContentBlock.createMany({
      data: batch.map((block) => ({
        articleId,
        locale,
        blockIndex: block.blockIndex,
        anchorId: block.anchorId,
        title: block.title,
        level: block.level,
        html: block.html,
        textLength: block.textLength
      }))
    });
  }
}
