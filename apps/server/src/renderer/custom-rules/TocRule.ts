import type { CustomRule } from "./CustomRuleEngine.js";

interface HeadingEntry {
  level: number;
  text: string;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function extractHeadings(markdown: string): HeadingEntry[] {
  return markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => /^(#{1,6})\s+(.+)$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({
      level: match[1].length,
      text: match[2].trim(),
    }));
}

function renderToc(headings: HeadingEntry[]): string {
  if (headings.length === 0) {
    return '<nav class="liax-toc" data-custom-rule="toc" aria-label="Table of contents"></nav>';
  }

  const items = headings.map((heading) => `<li data-heading-level="${heading.level}">${escapeHtml(heading.text)}</li>`).join("");

  return `<nav class="liax-toc" data-custom-rule="toc" aria-label="Table of contents"><ol>${items}</ol></nav>`;
}

export class TocRule implements CustomRule {
  readonly name = "toc";
  readonly version = "1";

  apply(markdown: string): string {
    return markdown.replace(/\[\[toc\]\]/gi, () => renderToc(extractHeadings(markdown)));
  }
}
