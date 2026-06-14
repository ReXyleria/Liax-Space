import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { UserService } from "./UserService.js";
import type { UserRecord } from "./users.types.js";

class FakeUserRepository {
  readonly users = new Map<number, UserRecord>();

  constructor(initialUsers: UserRecord[]) {
    for (const user of initialUsers) {
      this.users.set(user.id, user);
    }
  }

  async updatePasswordHash(id: number, passwordHash: string): Promise<UserRecord | null> {
    const user = this.users.get(id);

    if (!user) {
      return null;
    }

    const nextUser = {
      ...user,
      passwordHash,
      updatedAt: new Date("2026-06-14T00:00:01.000Z")
    };
    this.users.set(id, nextUser);
    return nextUser;
  }
}

function user(id: number, passwordHash: string): UserRecord {
  return {
    createdAt: new Date("2026-06-14T00:00:00.000Z"),
    disabledAt: null,
    email: `user${id}@example.test`,
    id,
    lastLoginAt: null,
    passwordHash,
    role: "svip",
    updatedAt: new Date("2026-06-14T00:00:00.000Z"),
    username: `user${id}`
  };
}

describe("UserService", () => {
  it("resets another user's password without exposing the password hash", async () => {
    const repository = new FakeUserRepository([user(1, "old-hash"), user(2, "old-target-hash")]);
    const service = new UserService(repository as never);

    const updated = await service.resetUserPassword(2, "new-target-hash", 1);

    assert.equal(repository.users.get(2)?.passwordHash, "new-target-hash");
    assert.equal(updated?.id, 2);
    assert.equal("passwordHash" in (updated as Record<string, unknown>), false);
  });

  it("rejects resetting the acting user's own password from user management", async () => {
    const service = new UserService(new FakeUserRepository([user(1, "old-hash")]) as never);

    await assert.rejects(
      () => service.resetUserPassword(1, "new-hash", 1),
      /Users cannot reset their own password from user management/
    );
  });
});
