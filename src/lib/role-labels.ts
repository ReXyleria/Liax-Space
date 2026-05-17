import { UserRole, UserStatus } from "@prisma/client";
import { t } from "@/lib/i18n-messages";

export function getRoleLabel(locale: string, role: UserRole) {
  const keys: Record<UserRole, string> = {
    USER: "user",
    SVIP: "svip",
    SSVIP: "ssvip",
    Administer: "admin"
  };
  return t(locale === "en" ? "en" : "zh-CN" as "zh-CN" | "en", keys[role]) || keys[role];
}

export function getStatusLabel(locale: string, status: UserStatus) {
  const keys: Record<UserStatus, string> = {
    ACTIVE: "active",
    DISABLED: "disabled"
  };
  return t(locale === "en" ? "en" : "zh-CN" as "zh-CN" | "en", keys[status]) || keys[status];
}

export const roleLabels: Record<UserRole, string> = {
  USER: "user",
  SVIP: "svip",
  SSVIP: "ssvip",
  Administer: "admin"
};

export const statusLabels: Record<UserStatus, string> = {
  ACTIVE: "active",
  DISABLED: "disabled"
};
