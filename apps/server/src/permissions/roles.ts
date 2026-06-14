export const roles = ["admin", "ssvip", "svip", "guest"] as const;

export type Role = (typeof roles)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}
