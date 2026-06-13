import type { CustomRule } from "./CustomRuleEngine.js";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderWarningBlock(lines: string[]): string {
  const paragraphs = lines
    .join("\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => `<p>${escapeHtml(paragraph.replace(/\s*\n\s*/g, " "))}</p>`)
    .join("");

  return `<aside class="liax-warning-block" data-custom-rule="warning-block" role="note"><strong>Warning</strong>${paragraphs}</aside>`;
}

export class WarningBlockRule implements CustomRule {
  readonly name = "warning-block";
  readonly version = "1";

  apply(markdown: string): string {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const outputLines: string[] = [];
    let index = 0;

    while (index < lines.length) {
      if (lines[index].trim() !== "::: warning") {
        outputLines.push(lines[index]);
        index += 1;
        continue;
      }

      const warningLines: string[] = [];
      index += 1;

      while (index < lines.length && lines[index].trim() !== ":::") {
        warningLines.push(lines[index]);
        index += 1;
      }

      if (index >= lines.length) {
        throw new Error("Unclosed warning block. Expected closing :::.");
      }

      outputLines.push(renderWarningBlock(warningLines));
      index += 1;
    }

    return outputLines.join("\n");
  }
}
