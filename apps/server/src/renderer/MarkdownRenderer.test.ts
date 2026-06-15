import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sha256 } from "../common/sha256.js";
import { MarkdownRenderer } from "./MarkdownRenderer.js";

describe("MarkdownRenderer", () => {
  it("renders headings, paragraphs, lists, and code blocks", async () => {
    const result = await new MarkdownRenderer().render({
      contentHash: "content-hash",
      markdown: [
        "# Title",
        "",
        "First paragraph.",
        "",
        "- One",
        "- Two",
        "",
        "1. First",
        "2. Second",
        "",
        "> Quoted note",
        "",
        "```ts",
        'const value = "<safe>";',
        "```",
      ].join("\n"),
    });

    assert.match(result.sanitizedBodyHtml, /<h1>Title<\/h1>/);
    assert.match(result.sanitizedBodyHtml, /<p>First paragraph\.<\/p>/);
    assert.match(result.sanitizedBodyHtml, /<ul>\s*<li>One<\/li>\s*<li>Two<\/li>\s*<\/ul>/);
    assert.match(result.sanitizedBodyHtml, /<ol>\s*<li>First<\/li>\s*<li>Second<\/li>\s*<\/ol>/);
    assert.match(result.sanitizedBodyHtml, /<blockquote>Quoted note<\/blockquote>/);
    assert.match(result.sanitizedBodyHtml, /<pre><code class="language-ts"><span class="liax-code-keyword">const<\/span> value = "&lt;safe&gt;";<\/code><\/pre>/);
  });

  it("wraps sanitized body HTML in the article template", async () => {
    const result = await new MarkdownRenderer().render({
      alternates: [
        { hreflang: "zh-CN", href: "https://example.com/zh/posts/title" },
        { hreflang: "en-US", href: "https://example.com/en/posts/title" }
      ],
      canonicalUrl: "https://example.com/zh/posts/title",
      contentHash: "content-hash",
      description: "中文摘要",
      locale: "zh-CN",
      markdown: "# 标题",
      templateVersion: "template-test",
      title: "中文标题",
    });

    assert.match(result.html, /^<!doctype html>/);
    assert.match(result.html, /<html lang="zh-CN">/);
    assert.match(result.html, /<title>中文标题<\/title>/);
    assert.match(result.html, /<meta name="description" content="中文摘要">/);
    assert.match(result.html, /<link rel="canonical" href="https:\/\/example\.com\/zh\/posts\/title">/);
    assert.match(result.html, /<link rel="alternate" hreflang="en-US" href="https:\/\/example\.com\/en\/posts\/title">/);
    assert.match(result.html, /data-language-switch-placeholder="true"/);
    assert.match(result.html, /data-locale-target="en-US"/);
    assert.doesNotMatch(result.html, /data-locale-target="zh-CN"/);
    assert.match(result.html, /<header class="liax-article-header">\s*<h1>中文标题<\/h1>\s*<\/header>/);
    assert.match(result.html, /--color-page: #faf9f5;/);
    assert.match(result.html, /--color-surface: #ffffff;/);
    assert.match(result.html, /--color-surface-muted: #f5f4ed;/);
    assert.match(result.html, /--color-border: #d1cfc5;/);
    assert.match(result.html, /--color-text: #141413;/);
    assert.match(result.html, /--color-primary: #141413;/);
    assert.match(result.html, /--color-primary-text: #faf9f5;/);
    assert.match(result.html, /--color-brand: #c96442;/);
    assert.match(result.html, /--color-brand-text: #faf9f5;/);
    assert.match(result.html, /--color-accent: #d97757;/);
    assert.match(result.html, /class="liax-article-card"/);
    const headerRule = result.html.match(/\.liax-public-header\s*\{(?<body>[\s\S]*?)\n    \}/)?.groups?.body ?? "";
    assert.match(headerRule, /height: 76px;/);
    assert.match(headerRule, /border-bottom: 1px solid var\(--color-border\);/);
    assert.doesNotMatch(headerRule, /border-radius/);
    assert.match(result.html, /\.liax-article-card\s*\{[\s\S]*?width: 100%;[\s\S]*?border: 0;[\s\S]*?background: transparent;/);
    assert.match(result.html, /class="liax-button liax-language-icon-button"/);
    assert.doesNotMatch(result.html, /liax-button--brand liax-language-icon-button/);
    assert.match(result.html, /<a class="liax-public-avatar" href="\/console" aria-label="Console"/);
    assert.match(result.html, /publicSearchOverlay/);
    assert.match(result.html, /data-public-search-overlay-trigger/);
    assert.match(result.html, /padding: "clamp\(72px, 16vh, 150px\) 24px 24px"/);
    assert.match(result.html, /backdropFilter: "blur\(18px\)"/);
    assert.match(result.html, /clip-path \$\{durationMs\}ms cubic-bezier\(0\.2, 0\.9, 0\.2, 1\)/);
    assert.match(result.html, /liax\.admin\.locale/);
    assert.match(result.html, /liax\.public\.locale/);
    assert.match(result.html, /window\.localStorage\?\.setItem\(adminLocaleStorageKey, locale\)/);
    assert.match(result.html, /window\.localStorage\?\.setItem\(publicLocaleStorageKey, locale\)/);
    assert.doesNotMatch(result.html, /liax-public-search-button/);
    assert.doesNotMatch(result.html, /background:\s*#fff(?:fff)?\b/i);
    assert.doesNotMatch(result.html, /#fffdf7/i);
    assert.doesNotMatch(result.html, /background(?:-image)?:\s*url\(/i);
    assert.doesNotMatch(result.html, /linear-gradient|radial-gradient/i);
  });

  it("calculates render_hash from content and version identifiers", async () => {
    const result = await new MarkdownRenderer().render({
      contentHash: "content-hash",
      customRuleVersion: "rules-v1",
      markdown: "Body",
      rendererVersion: "renderer-v1",
      templateVersion: "template-v1",
    });

    assert.equal(result.renderHash, sha256("content-hash" + "renderer-v1" + "template-v1" + "rules-v1"));
  });

  it("renders inline links, images, emphasis, and merged table cells", async () => {
    const result = await new MarkdownRenderer().render({
      contentHash: "content-hash",
      markdown: [
        "Paragraph with **bold**, *emphasis*, `code`, $E=mc^2$, [link](/target), and ![Alt](/uploads/image.png).",
        "",
        "| Name | Name | Value |",
        "| --- | --- | --- |",
        "| Same | Same | Other |",
        "| A | B | B |"
      ].join("\n")
    });

    assert.match(result.sanitizedBodyHtml, /<strong>bold<\/strong>/);
    assert.match(result.sanitizedBodyHtml, /<em>emphasis<\/em>/);
    assert.match(result.sanitizedBodyHtml, /<code>code<\/code>/);
    assert.match(result.sanitizedBodyHtml, /<span class="liax-math">E=mc\^2<\/span>/);
    assert.match(result.sanitizedBodyHtml, /<a href="\/target">link<\/a>/);
    assert.match(result.sanitizedBodyHtml, /<img alt="Alt" src="\/uploads\/image\.png">/);
    assert.match(result.sanitizedBodyHtml, /<th colspan="2">Name<\/th>/);
    assert.match(result.sanitizedBodyHtml, /<td colspan="2">Same<\/td>/);
    assert.match(result.sanitizedBodyHtml, /<td colspan="2">B<\/td>/);
  });

  it("applies custom rules and includes the rule version in render_hash", async () => {
    const result = await new MarkdownRenderer().render({
      contentHash: "content-hash",
      markdown: ["# Title", "", "[[toc]]", "", "::: warning", "Be careful.", ":::"].join("\n"),
      rendererVersion: "renderer-v1",
      templateVersion: "template-v1",
    });

    assert.equal(result.customRuleVersion, "warning-block@1+toc@1");
    assert.equal(result.renderHash, sha256("content-hash" + "renderer-v1" + "template-v1" + "warning-block@1+toc@1"));
    assert.match(result.sanitizedBodyHtml, /class="liax-toc"/);
    assert.match(result.sanitizedBodyHtml, /class="liax-warning-block"/);
  });

  it("keeps non-numeric attachment-like references unchanged", async () => {
    const result = await new MarkdownRenderer().render({
      contentHash: "content-hash",
      markdown: "![Alt](attachment://image-key)",
    });

    assert.match(result.sanitizedBodyHtml, /attachment:\/\/image-key/);
  });

  it("replaces attachment references and returns used attachments", async () => {
    const result = await new MarkdownRenderer(undefined, undefined, undefined, {
      async resolve(markdown) {
        return {
          markdown: markdown.replace("attachment://1", "/uploads/one.png"),
          usedAttachments: [{ id: 1, publicUrl: "/uploads/one.png" }]
        };
      }
    }).render({
      contentHash: "content-hash",
      markdown: "![Alt](attachment://1)"
    });

    assert.match(result.sanitizedBodyHtml, /\/uploads\/one\.png/);
    assert.deepEqual(result.usedAttachments, [{ id: 1, publicUrl: "/uploads/one.png" }]);
  });

  it("does not pass raw script HTML through", async () => {
    const result = await new MarkdownRenderer().render({
      contentHash: "content-hash",
      markdown: '<script>alert("x")</script>',
    });

    assert.doesNotMatch(result.sanitizedBodyHtml, /<script/i);
  });
});
