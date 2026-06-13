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
});
