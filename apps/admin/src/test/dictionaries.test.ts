import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { enUSDictionary } from "../i18n/dictionaries/en-US.js";
import { zhCNDictionary } from "../i18n/dictionaries/zh-CN.js";

describe("admin dictionaries", () => {
  it("keeps zh-CN and en-US keys aligned", () => {
    assert.deepEqual(Object.keys(enUSDictionary).sort(), Object.keys(zhCNDictionary).sort());
  });

  it("keeps the workspace app title stable", () => {
    assert.equal(zhCNDictionary["app.title"], "Liax Space 工作台");
    assert.equal(enUSDictionary["app.title"], "Liax Space Console");
  });
});
