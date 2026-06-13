import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sha256 } from "./sha256.js";

describe("sha256", () => {
  it("returns a 64 character hex digest", () => {
    const digest = sha256("Liax Space");

    assert.equal(digest.length, 64);
    assert.match(digest, /^[a-f0-9]{64}$/);
  });

  it("matches a known SHA-256 digest", () => {
    assert.equal(sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
