import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldRenderPublicSearchHtml } from "./search.routes.js";

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
