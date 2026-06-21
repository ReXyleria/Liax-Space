import { sanitizeHtml } from "./HtmlSanitizer.js";
import { RenderHashService } from "./RenderHashService.js";
import { TemplateRenderer } from "./TemplateRenderer.js";
import { AttachmentResolver, type AttachmentResolverLike } from "./AttachmentResolver.js";
import type { CustomRuleEngine } from "./custom-rules/CustomRuleEngine.js";
import { defaultCustomRuleEngine } from "./custom-rules/rules.js";
import {
  DEFAULT_RENDERER_VERSION,
  DEFAULT_TEMPLATE_VERSION,
  type ArticleTocItem,
  type MarkdownRenderInput,
  type MarkdownRenderResult,
} from "./renderer.types.js";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

const codeTokenPattern = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?)\b|\b(?:abstract|async|await|boolean|break|case|catch|class|const|continue|default|else|enum|export|extends|false|finally|for|from|function|if|import|interface|let|new|null|number|private|protected|public|return|string|switch|throw|true|try|type|undefined|while)\b/g;

function classForCodeToken(token: string): string {
  if (token.startsWith("//") || token.startsWith("/*")) {
    return "liax-code-comment";
  }

  if (/^["'`]/u.test(token)) {
    return "liax-code-string";
  }

  if (/^(?:0x[\da-f]+|\d)/iu.test(token)) {
    return "liax-code-number";
  }

  return "liax-code-keyword";
}

function renderHighlightedCode(value: string): string {
  let highlighted = "";
  let lastIndex = 0;

  for (const match of value.matchAll(codeTokenPattern)) {
    const token = match[0];
    const tokenIndex = match.index ?? 0;
    highlighted += escapeHtml(value.slice(lastIndex, tokenIndex));
    highlighted += `<span class="${classForCodeToken(token)}">${escapeHtml(token)}</span>`;
    lastIndex = tokenIndex + token.length;
  }

  return highlighted + escapeHtml(value.slice(lastIndex));
}

function renderInlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_match, altText: string, sourceUrl: string) => {
      return `<img alt="${escapeAttribute(altText)}" src="${escapeAttribute(sourceUrl)}">`;
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, linkText: string, href: string) => {
      return `<a href="${escapeAttribute(href)}">${escapeHtml(linkText)}</a>`;
    })
    .replace(/\$([^$\n]+)\$/g, (_match, mathText: string) => {
      return `<span class="liax-math">${escapeHtml(mathText.trim())}</span>`;
    })
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function isBlank(line: string): boolean {
  return line.trim().length === 0;
}

function isHeading(line: string): boolean {
  return /^#{1,6}\s+/.test(line);
}

function isCodeFence(line: string): boolean {
  return line.trimStart().startsWith("```");
}

function isUnorderedListItem(line: string): boolean {
  return /^\s*[-*+]\s+/.test(line);
}

function isOrderedListItem(line: string): boolean {
  return /^\s*\d+\.\s+/.test(line);
}

function isBlockquoteLine(line: string): boolean {
  return /^\s*>\s?/.test(line);
}

function isHtmlBlockLine(line: string): boolean {
  return /^<\/?[A-Za-z][\s\S]*>\s*$/.test(line.trim());
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.includes("|") && !trimmed.startsWith("```");
}

function isTableSeparator(line: string): boolean {
  const normalized = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells = normalized.split("|").map((cell) => cell.trim());

  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

interface MarkdownRenderContext {
  tocItems: ArticleTocItem[];
  usedHeadingIds: Set<string>;
}

function isArticleTocHeadingLevel(level: number): level is ArticleTocItem["level"] {
  return level >= 2 && level <= 4;
}

function plainHeadingText(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\$([^$\n]+)\$/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createHeadingSlug(text: string, index: number): string {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return normalized || `section-${index + 1}`;
}

function createUniqueHeadingId(baseId: string, usedIds: Set<string>): string {
  let nextId = baseId;
  let suffix = 2;

  while (usedIds.has(nextId)) {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(nextId);
  return nextId;
}

function renderHeading(line: string, context: MarkdownRenderContext): string {
  const match = /^(#{1,6})\s+(.+)$/.exec(line);

  if (match === null) {
    return `<p>${escapeHtml(line)}</p>`;
  }

  const level = match[1].length;
  const headingSource = match[2].trim();

  if (!isArticleTocHeadingLevel(level)) {
    return `<h${level}>${renderInlineMarkdown(headingSource)}</h${level}>`;
  }

  const headingText = plainHeadingText(headingSource) || `Section ${context.tocItems.length + 1}`;
  const headingId = createUniqueHeadingId(createHeadingSlug(headingText, context.tocItems.length), context.usedHeadingIds);
  context.tocItems.push({ id: headingId, level, text: headingText });

  return `<h${level} id="${escapeAttribute(headingId)}">${renderInlineMarkdown(headingSource)}</h${level}>`;
}

function renderCodeBlock(lines: string[], startIndex: number): { html: string; nextIndex: number } {
  const openingLine = lines[startIndex].trim();
  const language = openingLine.slice(3).trim().split(/\s+/)[0]?.replace(/[^A-Za-z0-9_-]/g, "");
  const codeLines: string[] = [];
  let index = startIndex + 1;

  while (index < lines.length && !isCodeFence(lines[index])) {
    codeLines.push(lines[index]);
    index += 1;
  }

  const nextIndex = index < lines.length ? index + 1 : index;
  const classAttribute = language === undefined || language.length === 0 ? "" : ` class="language-${language}"`;

  return {
    html: `<pre><code${classAttribute}>${renderHighlightedCode(codeLines.join("\n"))}</code></pre>`,
    nextIndex,
  };
}

function renderList(lines: string[], startIndex: number, ordered: boolean): { html: string; nextIndex: number } {
  const itemPattern = ordered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/;
  const items: string[] = [];
  let index = startIndex;

  while (index < lines.length) {
    const match = itemPattern.exec(lines[index]);

    if (match === null) {
      break;
    }

    items.push(`<li>${renderInlineMarkdown(match[1].trim())}</li>`);
    index += 1;
  }

  const tagName = ordered ? "ol" : "ul";

  return {
    html: `<${tagName}>\n${items.join("\n")}\n</${tagName}>`,
    nextIndex: index,
  };
}

function renderBlockquote(lines: string[], startIndex: number): { html: string; nextIndex: number } {
  const quoteLines: string[] = [];
  let index = startIndex;

  while (index < lines.length && isBlockquoteLine(lines[index])) {
    quoteLines.push(lines[index].replace(/^\s*>\s?/, "").trim());
    index += 1;
  }

  return {
    html: `<blockquote>${renderInlineMarkdown(quoteLines.join(" "))}</blockquote>`,
    nextIndex: index
  };
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function renderTableCells(cells: string[], tagName: "td" | "th"): string {
  const renderedCells: string[] = [];
  let index = 0;

  while (index < cells.length) {
    const value = cells[index] ?? "";
    let span = 1;

    while (index + span < cells.length && (cells[index + span] ?? "") === value) {
      span += 1;
    }

    const colspan = span > 1 ? ` colspan="${span}"` : "";
    renderedCells.push(`<${tagName}${colspan}>${renderInlineMarkdown(value)}</${tagName}>`);
    index += span;
  }

  return renderedCells.join("");
}

function renderTable(lines: string[], startIndex: number): { html: string; nextIndex: number } {
  const headerCells = splitTableRow(lines[startIndex]);
  const bodyRows: string[] = [];
  let index = startIndex + 2;

  while (index < lines.length && isTableRow(lines[index]) && !isTableSeparator(lines[index])) {
    const cells = splitTableRow(lines[index]);
    bodyRows.push(`<tr>${renderTableCells(cells, "td")}</tr>`);
    index += 1;
  }

  return {
    html: `<table>\n<thead><tr>${renderTableCells(headerCells, "th")}</tr></thead>\n<tbody>\n${bodyRows.join("\n")}\n</tbody>\n</table>`,
    nextIndex: index
  };
}

function renderParagraph(lines: string[], startIndex: number): { html: string; nextIndex: number } {
  const paragraphLines: string[] = [];
  let index = startIndex;

  while (
    index < lines.length &&
    !isBlank(lines[index]) &&
    !isHeading(lines[index]) &&
    !isCodeFence(lines[index]) &&
    !isUnorderedListItem(lines[index]) &&
    !isOrderedListItem(lines[index]) &&
    !isBlockquoteLine(lines[index]) &&
    !(isTableRow(lines[index]) && index + 1 < lines.length && isTableSeparator(lines[index + 1]))
  ) {
    paragraphLines.push(lines[index].trim());
    index += 1;
  }

  return {
    html: `<p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`,
    nextIndex: index,
  };
}

function renderMarkdownBody(markdown: string): { html: string; articleToc: ArticleTocItem[] } {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  const context: MarkdownRenderContext = { tocItems: [], usedHeadingIds: new Set() };
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (isBlank(line)) {
      index += 1;
      continue;
    }

    if (isCodeFence(line)) {
      const result = renderCodeBlock(lines, index);
      blocks.push(result.html);
      index = result.nextIndex;
      continue;
    }

    if (isHeading(line)) {
      blocks.push(renderHeading(line, context));
      index += 1;
      continue;
    }

    if (isHtmlBlockLine(line)) {
      blocks.push(line.trim());
      index += 1;
      continue;
    }

    if (isTableRow(line) && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const result = renderTable(lines, index);
      blocks.push(result.html);
      index = result.nextIndex;
      continue;
    }

    if (isUnorderedListItem(line)) {
      const result = renderList(lines, index, false);
      blocks.push(result.html);
      index = result.nextIndex;
      continue;
    }

    if (isOrderedListItem(line)) {
      const result = renderList(lines, index, true);
      blocks.push(result.html);
      index = result.nextIndex;
      continue;
    }

    if (isBlockquoteLine(line)) {
      const result = renderBlockquote(lines, index);
      blocks.push(result.html);
      index = result.nextIndex;
      continue;
    }

    const result = renderParagraph(lines, index);
    blocks.push(result.html);
    index = result.nextIndex;
  }

  return { html: blocks.join("\n"), articleToc: context.tocItems };
}

export class MarkdownRenderer {
  constructor(
    private readonly templateRenderer = new TemplateRenderer(),
    private readonly renderHashService = new RenderHashService(),
    private readonly customRuleEngine: CustomRuleEngine = defaultCustomRuleEngine,
    private readonly attachmentResolver: AttachmentResolverLike = new AttachmentResolver()
  ) {}

  async render(input: MarkdownRenderInput): Promise<MarkdownRenderResult> {
    const rendererVersion = input.rendererVersion ?? DEFAULT_RENDERER_VERSION;
    const templateVersion = input.templateVersion ?? DEFAULT_TEMPLATE_VERSION;
    const customRuleVersion = input.customRuleVersion ?? this.customRuleEngine.getVersion();
    const attachmentResolution = await this.attachmentResolver.resolve(input.markdown);
    const markdownWithCustomRules = this.customRuleEngine.apply(attachmentResolution.markdown);
    const { html: bodyHtml, articleToc } = renderMarkdownBody(markdownWithCustomRules);
    const sanitizedBodyHtml = sanitizeHtml(bodyHtml);
    const html = this.templateRenderer.render({
      allowedRoles: input.allowedRoles,
      alternates: input.alternates,
      articleToc,
      bodyHtml: sanitizedBodyHtml,
      canonicalUrl: input.canonicalUrl,
      description: input.description,
      locale: input.locale,
      templateVersion,
      title: input.title,
    });
    const renderHash = this.renderHashService.calculateRenderHash({
      contentHash: input.contentHash,
      customRuleVersion,
      rendererVersion,
      templateVersion,
    });

    return {
      bodyHtml,
      contentHash: input.contentHash,
      customRuleVersion,
      html,
      renderHash,
      rendererVersion,
      sanitizedBodyHtml,
      templateVersion,
      articleToc,
      usedAttachments: attachmentResolution.usedAttachments
    };
  }
}
