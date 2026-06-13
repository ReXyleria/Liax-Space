import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { WarningBlockRule } from "./WarningBlockRule.js";

describe("WarningBlockRule", () => {
  it("renders warning blocks", () => {
    const markdown = ["Before", "", "::: warning", "Careful <value>", "", "Second line", ":::", "", "After"].join("\n");
    const result = new WarningBlockRule().apply(markdown);

    assert.match(result, /Before/);
    assert.match(
      result,
      /<aside class="liax-warning-block" data-custom-rule="warning-block" role="note"><strong>Warning<\/strong><p>Careful &lt;value&gt;<\/p><p>Second line<\/p><\/aside>/,
    );
    assert.match(result, /After/);
  });

  it("returns a clear error for unclosed warning blocks", () => {
    assert.throws(() => new WarningBlockRule().apply("::: warning\nMissing close"), /Unclosed warning block\. Expected closing :::\./);
  });
});
