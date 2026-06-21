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
        "// keep return as comment",
        "return 42;",
        "```",
      ].join("\n"),
    });

    assert.match(result.sanitizedBodyHtml, /<h1>Title<\/h1>/);
    assert.match(result.sanitizedBodyHtml, /<p>First paragraph\.<\/p>/);
    assert.match(result.sanitizedBodyHtml, /<ul>\s*<li>One<\/li>\s*<li>Two<\/li>\s*<\/ul>/);
    assert.match(result.sanitizedBodyHtml, /<ol>\s*<li>First<\/li>\s*<li>Second<\/li>\s*<\/ol>/);
    assert.match(result.sanitizedBodyHtml, /<blockquote>Quoted note<\/blockquote>/);
    assert.match(result.sanitizedBodyHtml, /<span class="liax-code-keyword">const<\/span> value = <span class="liax-code-string">"&lt;safe&gt;"<\/span>;/);
    assert.match(result.sanitizedBodyHtml, /<span class="liax-code-comment">\/\/ keep return as comment<\/span>/);
    assert.match(result.sanitizedBodyHtml, /<span class="liax-code-keyword">return<\/span> <span class="liax-code-number">42<\/span>;/);
  });

  it("renders server-side article contents and heading anchors", async () => {
    const result = await new MarkdownRenderer().render({
      contentHash: "content-hash",
      locale: "zh-CN",
      markdown: [
        "# 长文标题",
        "",
        "## 第一节",
        "正文",
        "",
        "### 深入 **细节**",
        "正文",
        "",
        "#### 复盘",
        "正文",
        "",
        "## 第一节"
      ].join("\n"),
      title: "长文标题"
    });

    assert.deepEqual(result.articleToc, [
      { id: "第一节", level: 2, text: "第一节" },
      { id: "深入-细节", level: 3, text: "深入 细节" },
      { id: "复盘", level: 4, text: "复盘" },
      { id: "第一节-2", level: 2, text: "第一节" }
    ]);
    assert.match(result.sanitizedBodyHtml, /<h2 id="第一节">第一节<\/h2>/);
    assert.match(result.sanitizedBodyHtml, /<h3 id="深入-细节">深入 <strong>细节<\/strong><\/h3>/);
    assert.match(result.sanitizedBodyHtml, /<h4 id="复盘">复盘<\/h4>/);
    assert.match(result.html, /<nav class="liax-article-toc" aria-label="标题目录">/);
    assert.match(result.html, /<li data-level="2"><a href="#第一节">第一节<\/a><\/li>/);
    assert.match(result.html, /<li data-level="3"><a href="#深入-细节">深入 细节<\/a><\/li>/);
    assert.match(result.html, /<li data-level="4"><a href="#复盘">复盘<\/a><\/li>/);
    assert.match(result.html, /<li data-level="2"><a href="#第一节-2">第一节<\/a><\/li>/);
    assert.match(result.html, /scroll-margin-top: 96px;/);
    assert.doesNotMatch(result.html, /<a href="#长文标题">/);
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
    assert.match(headerRule, /max-width: 100vw;/);
    assert.doesNotMatch(headerRule, /border-radius/);
    assert.match(result.html, /\.liax-article-card\s*\{[\s\S]*?width: 100%;[\s\S]*?border: 0;[\s\S]*?background: transparent;/);
    assert.match(result.html, /\*,\s*\*::before,\s*\*::after\s*\{[\s\S]*?box-sizing: border-box;/);
    assert.match(result.html, /\.liax-article-card\s*\{[\s\S]*?max-width: 100vw;[\s\S]*?overflow-x: clip;/);
    assert.match(result.html, /\.liax-article-body\s*\{[\s\S]*?min-width: 0;[\s\S]*?max-width: 100%;/);
    assert.doesNotMatch(result.html, /translateY\(10px\)/);
    assert.match(result.html, /class="liax-button liax-language-icon-button"/);
    assert.doesNotMatch(result.html, /liax-button--brand liax-language-icon-button/);
    assert.match(result.html, /<a class="liax-public-avatar" href="\/console" aria-label="Console"/);
    assert.match(result.html, /publicSearchOverlay/);
    assert.match(result.html, /\.liax-code-string\s*\{[\s\S]*?color: #9ece6a;/);
    assert.match(result.html, /\.liax-code-number\s*\{[\s\S]*?color: #ff9e64;/);
    assert.match(result.html, /\.liax-code-comment\s*\{[\s\S]*?color: #565f89;/);
    assert.match(result.html, /data-public-search-overlay-trigger/);
    assert.match(result.html, /padding: "clamp\(72px, 16vh, 150px\) 24px 24px"/);
    assert.match(result.html, /backdropFilter: "blur\(2px\)"/);
    assert.match(result.html, /background: "rgba\(250, 249, 245, 0\.42\)"/);
    assert.match(result.html, /node\.style\.transition = "opacity 80ms ease"/);
    assert.doesNotMatch(result.html, /clip-path/i);
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

  it("renders compact article audience metadata when publish visibility is supplied", async () => {
    const result = await new MarkdownRenderer().render({
      allowedRoles: ["svip"],
      contentHash: "content-hash",
      locale: "zh-CN",
      markdown: "# 标题",
      title: "中文标题",
    });

    assert.match(result.html, /<p class="liax-article-audience"><span>可见范围<\/span><strong>SVIP 及以上<\/strong><\/p>/);
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
