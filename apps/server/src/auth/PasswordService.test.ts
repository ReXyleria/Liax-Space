import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashPassword, verifyPassword } from "./PasswordService.js";

describe("PasswordService", () => {
  it("verifies the correct password", async () => {
    const passwordHash = await hashPassword("correct-password");

    assert.equal(await verifyPassword("correct-password", passwordHash), true);
  });

  it("rejects the wrong password", async () => {
    const passwordHash = await hashPassword("correct-password");

    assert.equal(await verifyPassword("wrong-password", passwordHash), false);
  });

  it("does not return the plaintext password as the hash", async () => {
    const password = "plain-password";
    const passwordHash = await hashPassword(password);

    assert.notEqual(passwordHash, password);
  });
});
