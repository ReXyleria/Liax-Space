import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { describe, it } from "node:test";

import {
  createEditorHeadingId,
  extractHeadingsFromMarkdown,
  extractImageSourceFromMarkdown,
  filterSlashMenuOptions,
  markdownToHtml
} from "../components/MarkdownEditor";

describe("MarkdownEditor helpers", () => {
  it("extracts the source URL from an image markdown snippet", () => {
    assert.equal(extractImageSourceFromMarkdown("![pasted image](attachment://42)"), "attachment://42");
    assert.equal(extractImageSourceFromMarkdown("  ![remote](https://example.com/image.png)  "), "https://example.com/image.png");
  });

  it("does not treat arbitrary text as an image source", () => {
    assert.equal(extractImageSourceFromMarkdown("attachment://42"), null);
    assert.equal(extractImageSourceFromMarkdown("![broken]"), null);
  });

  it("extracts H1-H6 headings for the editor outline", () => {
    assert.deepEqual(extractHeadingsFromMarkdown("# 开始\n\n正文\n\n### Deep **Part**\n\n###### Last"), [
      { id: "heading-0-开始", level: 1, text: "开始" },
      { id: "heading-1-deep-part", level: 3, text: "Deep Part" },
      { id: "heading-2-last", level: 6, text: "Last" }
    ]);
  });

  it("adds stable heading ids to rendered editor HTML", () => {
    assert.equal(createEditorHeadingId("A Title", 0), "heading-0-a-title");
    assert.match(markdownToHtml("# A Title"), /<h1 data-editor-heading-id="heading-0-a-title">A Title<\/h1>/);
  });

  it("adds an editable paragraph after a trailing code block", () => {
    assert.match(markdownToHtml("```ts\nx = 1\n```"), /<\/pre><p><br><\/p>$/);
  });

  it("adds an editable paragraph after a trailing table", () => {
    assert.match(markdownToHtml("| A | B |\n| --- | --- |\n| 1 | 2 |"), /<\/table><p><br><\/p>$/);
  });

  it("merges adjacent matching table cells horizontally", () => {
    assert.match(
      markdownToHtml("| A | B | C |\n| --- | --- | --- |\n| Same | Same | Other |"),
      /<td colspan="2">Same<\/td><td>Other<\/td>/
    );
  });

  it("merges adjacent matching table cells vertically", () => {
    assert.match(
      markdownToHtml("| Name | Value |\n| --- | --- |\n| Same | A |\n| Same | B |"),
      /<td rowspan="2">Same<\/td><td>A<\/td>/
    );
  });

  it("filters slash menu options by label, description, or keyword", () => {
    const options = [
      { description: "Insert a table", id: "table" as const, keywords: ["表格"], label: "Table" },
      { description: "Insert code", id: "code" as const, keywords: ["代码"], label: "Code block" }
    ];

    assert.deepEqual(filterSlashMenuOptions(options, "表").map((option) => option.id), ["table"]);
    assert.deepEqual(filterSlashMenuOptions(options, "code").map((option) => option.id), ["code"]);
    assert.deepEqual(filterSlashMenuOptions(options, "").map((option) => option.id), ["table", "code"]);
  });

  it("renders a long editor document within a practical interaction budget", () => {
    const markdown = Array.from({ length: 240 }, (_item, index) => {
      const sectionNumber = index + 1;

      return [
        `## Section ${sectionNumber}`,
        "",
        `Paragraph ${sectionNumber} with **bold text**, \`inline code\`, and $E=${sectionNumber}mc^2$.`,
        "",
        "| Name | Value | Value |",
        "| --- | --- | --- |",
        `| Row ${sectionNumber} | Same | Same |`,
        "",
        "```ts",
        `const value${sectionNumber} = ${sectionNumber};`,
        "```"
      ].join("\n");
    }).join("\n\n");

    const startedAt = performance.now();
    const headings = extractHeadingsFromMarkdown(markdown);
    const html = markdownToHtml(markdown);
    const elapsedMs = performance.now() - startedAt;

    assert.equal(headings.length, 240);
    assert.match(html, /<span class="admin-code-keyword">const<\/span> value240 = 240;/);
    assert.match(html, /<td colspan="2">Same<\/td>/);
    assert.ok(elapsedMs < 1500, `Long document render took ${elapsedMs.toFixed(1)}ms.`);
  });
});
