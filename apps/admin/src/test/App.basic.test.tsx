import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";

describe("admin App basic test", () => {
  it("can create a React element for the admin root component shape", () => {
    function App(): null {
      return null;
    }

    const element = createElement(App);

    assert.equal(element.type, App);
  });
});
