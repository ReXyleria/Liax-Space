import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { colorTokens } from "./tokens.js";

describe("colorTokens", () => {
  it("exports the design token values", () => {
    assert.deepEqual(colorTokens, {
      "--color-page": "#faf9f5",
      "--color-surface": "#ffffff",
      "--color-surface-muted": "#f5f4ed",
      "--color-border": "#d1cfc5",
      "--color-text": "#141413",
      "--color-primary": "#141413",
      "--color-primary-text": "#faf9f5",
      "--color-brand": "#c96442",
      "--color-brand-text": "#faf9f5",
      "--color-accent": "#d97757"
    });
  });

  it("does not define disallowed visual colors", () => {
    const tokenValues = Object.values(colorTokens);

    assert.equal(tokenValues.includes("#000000"), false);
    assert.equal(tokenValues.includes("#ffffff"), true);
    assert.equal(tokenValues.includes("#0000ff"), false);
    assert.equal(tokenValues.includes("#6366f1"), false);
    assert.equal(tokenValues.includes("#8b5cf6"), false);
  });
});

