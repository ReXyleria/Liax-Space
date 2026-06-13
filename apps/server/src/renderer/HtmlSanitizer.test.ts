import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sanitizeHtml } from "./HtmlSanitizer.js";

describe("sanitizeHtml", () => {
  it("removes script elements", () => {
    assert.equal(sanitizeHtml("<p>Hello</p><script>alert(1)</script><p>World</p>"), "<p>Hello</p><p>World</p>");
  });

  it("removes event attributes", () => {
    assert.equal(sanitizeHtml('<img src="/image.png" onerror="alert(1)" onclick="alert(2)">'), '<img src="/image.png">');
  });

  it("forbids javascript URLs", () => {
    assert.equal(sanitizeHtml('<a href="javascript:alert(1)">bad</a>'), "<a>bad</a>");
  });

  it("forbids javascript URLs with encoded colon", () => {
    assert.equal(sanitizeHtml('<a href="java&#x3A;script:alert(1)">bad</a>'), "<a>bad</a>");
  });

  it("forbids javascript URLs with encoded letters", () => {
    assert.equal(sanitizeHtml('<a href="java&#115;cript:alert(1)">bad</a>'), "<a>bad</a>");
  });

  it("removes iframe elements by default", () => {
    assert.equal(sanitizeHtml('<p>before</p><iframe src="https://example.com"></iframe><p>after</p>'), "<p>before</p><p>after</p>");
  });

  it("removes style attributes by default", () => {
    assert.equal(sanitizeHtml('<p style="color: red" class="lead">Text</p>'), '<p class="lead">Text</p>');
  });
});
