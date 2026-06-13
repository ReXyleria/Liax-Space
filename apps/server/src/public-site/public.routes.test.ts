import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPublicLocalePrefix } from "./public.routes.js";

describe("public route locale matching", () => {
  it("only treats zh and en as public locale prefixes", () => {
    assert.equal(isPublicLocalePrefix("zh"), true);
    assert.equal(isPublicLocalePrefix("en"), true);
    assert.equal(isPublicLocalePrefix("admin"), false);
    assert.equal(isPublicLocalePrefix("setup"), false);
    assert.equal(isPublicLocalePrefix(undefined), false);
  });
});
