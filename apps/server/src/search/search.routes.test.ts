import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderPublicSearchPage, shouldRenderPublicSearchHtml } from "./search.routes.js";

describe("public search response negotiation", () => {
  it("renders HTML by default for public search URLs", () => {
    assert.equal(shouldRenderPublicSearchHtml(undefined), true);
    assert.equal(shouldRenderPublicSearchHtml(""), true);
    assert.equal(shouldRenderPublicSearchHtml("*/*"), true);
    assert.equal(shouldRenderPublicSearchHtml("text/html,application/xhtml+xml"), true);
  });

  it("returns JSON only for explicit JSON clients", () => {
    assert.equal(shouldRenderPublicSearchHtml("application/json"), false);
  });
});

describe("public search page rendering", () => {
  it("keeps the back link in normal layout flow before the title", () => {
    const html = renderPublicSearchPage("zh", "qa", []);

    assert.match(html, /\.liax-search-back\s*{[^}]*display:\s*flex;/s);
    assert.match(html, /\.liax-search-back\s*{[^}]*margin-bottom:\s*18px;/s);
    assert.match(html, /<a class="liax-search-back" href="\/zh">Liax Space<\/a>\s*<h1>搜索<\/h1>/);
  });

  it("uses the updated public chrome and search overlay contract", () => {
    const html = renderPublicSearchPage("en", "docs", [], {
      "site.logoAlt": "Search logo",
      "site.logoUrl": "/uploads/search-logo.png"
    }, "/uploads/search-avatar.webp");

    assert.match(html, /<link rel="icon" href="\/uploads\/search-logo\.png">/);
    assert.match(html, /<link rel="apple-touch-icon" href="\/uploads\/search-logo\.png">/);
    assert.match(html, /<meta property="og:image" content="\/uploads\/search-logo\.png">/);
    assert.match(html, /<meta property="og:image:alt" content="Search logo">/);
    assert.match(html, /<meta name="twitter:image" content="\/uploads\/search-logo\.png">/);
    assert.match(html, /<span class="liax-public-logo"><img alt="Search logo" onerror="this\.remove\(\)" src="\/uploads\/search-logo\.png"><\/span>/);
    assert.match(html, /<a class="liax-public-avatar" href="\/console" aria-label="Console"><span aria-hidden="true">A<\/span><img alt="" onerror="this\.remove\(\)" src="\/uploads\/search-avatar\.webp"><\/a>/);
    assert.match(html, /data-public-search-overlay-trigger/);
    assert.match(html, /Search scope/);
    assert.match(html, /href="\/en\/posts">Articles<\/a>/);
    assert.match(html, /href="\/en\/tags">All tags<\/a>/);
    assert.match(html, /href="\/en\/moments">Moments<\/a>/);
    assert.doesNotMatch(html, /href="\/en\/contact"/);
    assert.match(html, /width: min\(1560px, calc\(100% - clamp\(24px, 5vw, 80px\)\)\)/);
    assert.doesNotMatch(html, /href="\/en\/account"/);
  });

  it("renders a localized empty state with search scope and recovery links", () => {
    const html = renderPublicSearchPage("zh", "missing", []);

    assert.match(html, /搜索范围/);
    assert.match(html, /当前搜索覆盖已发布文章、标签、瞬间和首页内容/);
    assert.match(html, /href="\/zh\/posts">文章列表<\/a>/);
    assert.match(html, /href="\/zh\/tags">全部标签<\/a>/);
    assert.match(html, /href="\/zh\/moments">瞬间<\/a>/);
  });

  it("renders search result read counts from public search results", () => {
    const html = renderPublicSearchPage("en", "docs", [{
      articleId: 1,
      articleStatus: "published",
      locale: "en-US",
      publishedAt: new Date("2026-06-01T08:00:00.000Z"),
      publishStatus: "published",
      seoDescription: null,
      seoTitle: null,
      slug: "docs",
      summary: "Search summary",
      title: "Docs",
      updatedAt: new Date("2026-06-01T08:00:00.000Z"),
      url: "/en/posts/docs",
      visitCount: 1
    }]);

    assert.match(html, /<small>1 read<\/small>/);
  });

  it("renders non-article search result types without fake read counts", () => {
    const html = renderPublicSearchPage("zh", "生活", [{
      articleId: 0,
      articleStatus: "published",
      kind: "tag",
      locale: "zh-CN",
      publishedAt: new Date("2026-06-01T08:00:00.000Z"),
      publishStatus: "published",
      seoDescription: null,
      seoTitle: null,
      slug: "life",
      summary: "3 篇文章",
      title: "标签: 生活",
      updatedAt: new Date("2026-06-01T08:00:00.000Z"),
      url: "/zh/tags/life",
      visitCount: 0
    }]);

    assert.match(html, /<small>标签<\/small>/);
    assert.doesNotMatch(html, /0 阅读/);
  });
});
