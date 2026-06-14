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
    const html = renderPublicSearchPage("en", "docs", []);

    assert.match(html, /<a class="liax-public-avatar" href="\/console" aria-label="Console"/);
    assert.match(html, /data-public-search-overlay-trigger/);
    assert.match(html, /width: min\(1440px, calc\(100% - clamp\(32px, 6vw, 96px\)\)\)/);
    assert.doesNotMatch(html, /href="\/en\/account"/);
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
});
