import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CustomRuleEngine, CustomRuleError, type CustomRule } from "./CustomRuleEngine.js";

describe("CustomRuleEngine", () => {
  it("applies rules in order", () => {
    const firstRule: CustomRule = {
      name: "first",
      version: "1",
      apply: (markdown) => `${markdown}A`,
    };
    const secondRule: CustomRule = {
      name: "second",
      version: "2",
      apply: (markdown) => `${markdown}B`,
    };

    assert.equal(new CustomRuleEngine([firstRule, secondRule]).apply(""), "AB");
  });

  it("returns a stable version string", () => {
    const rules: CustomRule[] = [
      { name: "first", version: "1", apply: (markdown) => markdown },
      { name: "second", version: "2", apply: (markdown) => markdown },
    ];

    assert.equal(new CustomRuleEngine(rules).getVersion(), "first@1+second@2");
  });

  it("wraps rule failures with a clear error", () => {
    const brokenRule: CustomRule = {
      name: "broken",
      version: "1",
      apply: () => {
        throw new Error("bad input");
      },
    };

    assert.throws(
      () => new CustomRuleEngine([brokenRule]).apply("content"),
      (error) =>
        error instanceof CustomRuleError &&
        error.ruleName === "broken" &&
        error.message === 'Custom Markdown rule "broken" failed: bad input',
    );
  });
});
