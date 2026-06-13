import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TocRule } from "./TocRule.js";

describe("TocRule", () => {
  it("replaces toc markers with a heading list", () => {
    const markdown = ["# First", "", "[[toc]]", "", "## Second <Part>"].join("\n");
    const result = new TocRule().apply(markdown);

    assert.doesNotMatch(result, /\[\[toc\]\]/);
    assert.match(result, /<nav class="liax-toc" data-custom-rule="toc" aria-label="Table of contents">/);
    assert.match(result, /<li data-heading-level="1">First<\/li>/);
    assert.match(result, /<li data-heading-level="2">Second &lt;Part&gt;<\/li>/);
  });

  it("renders an empty toc when no headings exist", () => {
    const result = new TocRule().apply("[[toc]]");

    assert.equal(result, '<nav class="liax-toc" data-custom-rule="toc" aria-label="Table of contents"></nav>');
  });
});
