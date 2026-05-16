import { UserRole, UserStatus } from "@prisma/client";

export const roleLabels: Record<UserRole, string> = {
  USER: "user",
  SVIP: "svip",
  SSVIP: "ssvip",
  Administer: "Administer"
};

export const statusLabels: Record<UserStatus, string> = {
  ACTIVE: "启用",
  DISABLED: "禁用"
};
