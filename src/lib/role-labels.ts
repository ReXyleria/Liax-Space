import { UserRole, UserStatus } from "@prisma/client";

export const roleLabels: Record<UserRole, string> = {
  VISITOR: "visitor",
  USER: "user",
  FRIEND: "svip",
  VIP: "ssvip",
  EDITOR: "Editor",
  ADMIN: "Admin",
  OWNER: "Administer"
};

export const statusLabels: Record<UserStatus, string> = {
  ACTIVE: "启用",
  DISABLED: "禁用"
};
