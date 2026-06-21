import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { describe, it } from "node:test";

import {
  buildSlashMenuOptions,
  createIncrementalMarkdownPreview,
  createEditorHeadingId,
  extractHeadingsFromMarkdown,
  extractImageSourceFromMarkdown,
  filterSlashMenuOptions,
  incrementalVisualPreviewInitialLength,
  markdownToHtml,
  shouldUsePlainMarkdownEditor
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

  it("renders attachment image references as images when a preview URL is available", () => {
    const html = markdownToHtml("![diagram](attachment://42)", {
      attachmentPreviewUrls: {
        "42": "/uploads/diagram.png"
      }
    });

    assert.match(html, /<img alt="diagram" data-md-source="attachment:\/\/42" src="\/uploads\/diagram\.png">/);
    assert.doesNotMatch(html, /admin-attachment-chip/);
  });

  it("escapes external image query strings once", () => {
    const html = markdownToHtml("![chart](https://example.test/image.png?a=1&b=2)");

    assert.match(html, /src="https:\/\/example\.test\/image\.png\?a=1&amp;b=2"/);
    assert.doesNotMatch(html, /amp;amp/);
  });

  it("keeps unresolved attachment image references explicit instead of showing only the filename", () => {
    const html = markdownToHtml("![diagram](attachment://404)");

    assert.match(html, /class="admin-attachment-chip"/);
    assert.match(html, /Image unavailable: diagram/);
  });

  it("highlights editor code tokens with Tokyo Night classes", () => {
    const html = markdownToHtml(['```ts', 'const label = "ok";', '// keep return as comment', 'return 42;', '```'].join("\n"));

    assert.match(html, /<span class="admin-code-keyword">const<\/span> label = <span class="admin-code-string">&quot;ok&quot;<\/span>;/);
    assert.match(html, /<span class="admin-code-comment">\/\/ keep return as comment<\/span>/);
    assert.match(html, /<span class="admin-code-keyword">return<\/span> <span class="admin-code-number">42<\/span>;/);
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

  it("keeps the slash menu focused on H1-H4 headings without title directory insertion", () => {
    const options = buildSlashMenuOptions((key) => key, true);

    assert.deepEqual(options.map((option) => option.id), [
      "image",
      "heading1",
      "heading2",
      "heading3",
      "heading4",
      "table",
      "code",
      "quote",
      "math"
    ]);
    assert.equal(options.some((option) => option.label === "article.slashToc" || option.description === "article.slashTocDescription"), false);
  });

  it("keeps H1-H4 available when image upload is unavailable", () => {
    const options = buildSlashMenuOptions((key) => key, false);

    assert.deepEqual(options.map((option) => option.id), ["heading1", "heading2", "heading3", "heading4", "table", "code", "quote", "math"]);
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
    assert.match(html, /<span class="admin-code-keyword">const<\/span> value240 = <span class="admin-code-number">240<\/span>;/);
    assert.match(html, /<td colspan="2">Same<\/td>/);
    assert.ok(elapsedMs < 1500, `Long document render took ${elapsedMs.toFixed(1)}ms.`);
  });

  it("renders 12 MiB documents as incremental visual preview chunks", () => {
    const markdown = `# Large Markdown\n\n${"Large paragraph.\n\n".repeat(Math.ceil((12 * 1024 * 1024) / 18))}`;
    const startedAt = performance.now();
    const headings = extractHeadingsFromMarkdown(markdown);
    const preview = createIncrementalMarkdownPreview(markdown, incrementalVisualPreviewInitialLength);
    const html = markdownToHtml(preview.markdown);
    const elapsedMs = performance.now() - startedAt;

    assert.equal(shouldUsePlainMarkdownEditor(markdown), true);
    assert.equal(headings.length, 1);
    assert.equal(preview.hasMore, true);
    assert.ok(preview.markdown.length <= incrementalVisualPreviewInitialLength);
    assert.match(html, /<h1 data-editor-heading-id="heading-0-large-markdown">Large Markdown<\/h1>/);
    assert.ok(elapsedMs < 2000, `Large incremental preview took ${elapsedMs.toFixed(1)}ms.`);
  });
});
