import type { Role } from "./roles.js";

export const permissions = [
  "article:create",
  "article:update",
  "article:publish",
  "article:delete",
  "attachment:upload",
  "user:manage",
  "system:maintain"
] as const;

export type Permission = (typeof permissions)[number];

export const rolePermissions: Readonly<Record<Role, readonly Permission[]>> = {
  admin: permissions,
  editor: ["article:create", "article:update", "article:publish", "attachment:upload"],
  viewer: []
};

export function isPermission(value: unknown): value is Permission {
  return typeof value === "string" && permissions.includes(value as Permission);
}
