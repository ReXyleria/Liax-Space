import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPublicLocalePrefix, mapLegacyPublicSection, resolvePublicLocalePrefix } from "./public.routes.js";

describe("public route locale matching", () => {
  it("only treats zh and en as public locale prefixes", () => {
    assert.equal(isPublicLocalePrefix("zh"), true);
    assert.equal(isPublicLocalePrefix("en"), true);
    assert.equal(isPublicLocalePrefix("admin"), false);
    assert.equal(isPublicLocalePrefix("setup"), false);
    assert.equal(isPublicLocalePrefix(undefined), false);
  });

  it("maps legacy public locale prefixes to the current route prefixes", () => {
    assert.equal(resolvePublicLocalePrefix("zh-CN"), "zh");
    assert.equal(resolvePublicLocalePrefix("en-US"), "en");
    assert.equal(resolvePublicLocalePrefix("zh"), "zh");
    assert.equal(resolvePublicLocalePrefix("en"), "en");
    assert.equal(resolvePublicLocalePrefix("admin"), null);
  });

  it("maps legacy article list routes to the current posts section", () => {
    assert.equal(mapLegacyPublicSection("articles"), "posts");
    assert.equal(mapLegacyPublicSection("guestbook"), "guestbook");
    assert.equal(mapLegacyPublicSection("search"), "search");
    assert.equal(mapLegacyPublicSection("missing"), null);
    assert.equal(mapLegacyPublicSection(undefined), null);
  });
});
