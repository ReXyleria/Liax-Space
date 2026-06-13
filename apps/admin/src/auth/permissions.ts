import type { AdminPermission } from "../api/roleApi";
import type { AdminUser } from "../api/authApi";

const allPermissions: AdminPermission[] = [
  "article:create",
  "article:update",
  "article:publish",
  "article:delete",
  "attachment:upload",
  "user:manage",
  "system:maintain"
];

const builtInRolePermissions: Readonly<Record<string, readonly AdminPermission[]>> = {
  admin: allPermissions,
  editor: ["article:create", "article:update", "article:publish", "attachment:upload"],
  viewer: []
};

export function getUserPermissions(user: AdminUser | null): readonly AdminPermission[] {
  if (!user) {
    return [];
  }

  if (Array.isArray(user.permissions)) {
    return user.permissions;
  }

  return builtInRolePermissions[user.role] ?? [];
}

export function hasAnyPermission(user: AdminUser | null, permissions: readonly AdminPermission[]): boolean {
  if (permissions.length === 0) {
    return true;
  }

  const userPermissions = new Set(getUserPermissions(user));

  return permissions.some((permission) => userPermissions.has(permission));
}
