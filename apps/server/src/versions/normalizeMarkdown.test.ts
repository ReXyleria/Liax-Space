import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeMarkdown } from "./normalizeMarkdown.js";

describe("normalizeMarkdown", () => {
  it("converts CRLF to LF", () => {
    assert.equal(normalizeMarkdown("line 1\r\nline 2\r\n"), "line 1\nline 2");
  });

  it("removes extra blank lines at the end of the file", () => {
    assert.equal(normalizeMarkdown("# Title\n\n  \n\t\n"), "# Title");
  });

  it("does not change spaces inside the body", () => {
    const markdown = "a  b\n\nc    d\n  indented text\n\n";

    assert.equal(normalizeMarkdown(markdown), "a  b\n\nc    d\n  indented text");
  });
});
