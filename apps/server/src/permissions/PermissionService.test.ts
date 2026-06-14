import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PermissionService } from "./PermissionService.js";
import type { Permission } from "./permissions.js";
import type { RoleDefinition, RoleDefinitionInput } from "./RoleRepository.js";

class FakeRoleRepository {
  readonly roles = new Map<string, RoleDefinition>();
  readonly userCounts = new Map<string, number>();

  constructor(initialRoles: RoleDefinition[] = []) {
    for (const role of initialRoles) {
      this.roles.set(role.roleKey, role);
    }
  }

  async listRoles(): Promise<RoleDefinition[]> {
    return [...this.roles.values()].sort((left, right) => Number(right.builtIn) - Number(left.builtIn) || left.roleKey.localeCompare(right.roleKey));
  }

  async findByRoleKey(roleKey: string): Promise<RoleDefinition | null> {
    return this.roles.get(roleKey) ?? null;
  }

  async createRole(input: RoleDefinitionInput): Promise<RoleDefinition> {
    const role = {
      builtIn: input.builtIn ?? false,
      createdAt: new Date("2026-06-14T00:00:00.000Z"),
      displayName: input.displayName,
      permissions: input.permissions,
      roleKey: input.roleKey,
      updatedAt: new Date("2026-06-14T00:00:00.000Z")
    };
    this.roles.set(input.roleKey, role);
    return role;
  }

  async updateRole(roleKey: string, input: Pick<RoleDefinitionInput, "displayName" | "permissions">): Promise<RoleDefinition | null> {
    const role = this.roles.get(roleKey);

    if (!role) {
      return null;
    }

    const nextRole = {
      ...role,
      displayName: input.displayName,
      permissions: input.permissions,
      updatedAt: new Date("2026-06-14T00:00:01.000Z")
    };
    this.roles.set(roleKey, nextRole);
    return nextRole;
  }

  async deleteRole(roleKey: string): Promise<boolean> {
    if (roleKey === "admin") {
      return false;
    }

    return this.roles.delete(roleKey);
  }

  async countUsersByRole(roleKey: string): Promise<number> {
    return this.userCounts.get(roleKey) ?? 0;
  }
}

function role(roleKey: string, displayName: string, permissions: Permission[] = [], builtIn = false): RoleDefinition {
  return {
    builtIn,
    createdAt: new Date("2026-06-14T00:00:00.000Z"),
    displayName,
    permissions,
    roleKey,
    updatedAt: new Date("2026-06-14T00:00:00.000Z")
  };
}

describe("PermissionService", () => {
  it("keeps only Administer protected while allowing other identities to be managed", async () => {
    const repository = new FakeRoleRepository([
      role("admin", "Administer", ["system:maintain"], true),
      role("ssvip", "SSVIP")
    ]);
    const service = new PermissionService(repository as never);

    const created = await service.createRole({
      displayName: "Editor",
      permissions: ["article:update"],
      roleKey: "editor"
    });
    assert.equal(created.roleKey, "editor");
    assert.equal(created.builtIn, false);

    const updated = await service.updateRole("ssvip", {
      displayName: "Paid reader",
      permissions: ["article:publish"]
    });
    assert.equal(updated.displayName, "Paid reader");
    assert.deepEqual(updated.permissions, ["article:publish"]);

    assert.deepEqual(await service.deleteRole("editor"), { deleted: true });
    assert.equal(await repository.findByRoleKey("editor"), null);
  });

  it("rejects changes to the Administer identity", async () => {
    const service = new PermissionService(new FakeRoleRepository([
      role("admin", "Administer", ["system:maintain"], true)
    ]) as never);

    await assert.rejects(
      () => service.updateRole("admin", { displayName: "Owner", permissions: [] }),
      /Administer cannot be changed/
    );
    await assert.rejects(
      () => service.deleteRole("admin"),
      /Administer cannot be deleted/
    );
  });

  it("returns an Administer fallback when role rows have not been initialized", async () => {
    const service = new PermissionService(new FakeRoleRepository() as never);

    const roles = await service.listRoles();

    assert.equal(roles[0]?.roleKey, "admin");
    assert.equal(roles[0]?.displayName, "Administer");
    assert.equal(roles[0]?.builtIn, true);
    assert.ok(roles[0]?.permissions.includes("system:maintain"));
  });
});
