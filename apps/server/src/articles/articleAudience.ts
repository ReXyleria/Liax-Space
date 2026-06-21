export type AudienceLocale = "zh-CN" | "en-US" | string | undefined;

const roleRank: Record<string, number> = {
  guest: 0,
  svip: 1,
  ssvip: 2
};

function isZh(locale: AudienceLocale): boolean {
  return locale === "zh-CN";
}

function normalizeRoles(allowedRoles: readonly string[] | undefined): string[] {
  return [...new Set((allowedRoles ?? []).map((role) => role.trim()).filter(Boolean))];
}

function roleDisplayName(role: string, locale: AudienceLocale): string {
  if (role === "guest") {
    return isZh(locale) ? "游客" : "Guest";
  }

  if (role === "admin") {
    return "Administer";
  }

  return role.toUpperCase() === role ? role : role;
}

export function formatArticleAudienceLabel(allowedRoles: readonly string[] | undefined, locale: AudienceLocale): string {
  const roles = normalizeRoles(allowedRoles);

  if (roles.length === 0 || roles.includes("guest")) {
    return isZh(locale) ? "公开" : "Public";
  }

  const labels: string[] = [];

  if (roles.includes("svip")) {
    labels.push(isZh(locale) ? "SVIP 及以上" : "SVIP and above");
  } else if (roles.includes("ssvip")) {
    labels.push("SSVIP");
  }

  for (const role of roles) {
    if (role === "svip" || role === "ssvip") {
      continue;
    }

    labels.push(roleDisplayName(role, locale));
  }

  return labels.length > 0 ? labels.join(isZh(locale) ? "、" : ", ") : (isZh(locale) ? "指定身份" : "Selected identities");
}

export function canRoleViewArticleAudience(userRole: string | null, allowedRoles: readonly string[] | undefined): boolean {
  const roles = normalizeRoles(allowedRoles);

  if (roles.length === 0) {
    return true;
  }

  if (userRole === "admin") {
    return true;
  }

  if (userRole !== null) {
    if (roles.includes(userRole)) {
      return true;
    }

    const userRank = roleRank[userRole];
    const minimumRank = Math.min(...roles
      .map((role) => roleRank[role])
      .filter((rank): rank is number => rank !== undefined && rank > 0));

    if (Number.isFinite(minimumRank) && userRank !== undefined && userRank >= minimumRank) {
      return true;
    }
  }

  return userRole === null && roles.includes("guest");
}
