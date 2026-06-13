export function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n/g, "\n").replace(/(?:\n[ \t]*)+$/g, "");
}
