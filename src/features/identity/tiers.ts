import { UserRole } from "@prisma/client";
import { getDefaultPermissionsForRole } from "@/lib/permission-definitions";

export type PublicIdentityTierKey = "user" | "svip" | "ssvip";

export type PublicIdentityTier = {
  key: PublicIdentityTierKey;
  name: string;
  description: string;
  builtInRole: UserRole;
  rank: number;
};

export const publicIdentityTiers: PublicIdentityTier[] = [
  {
    key: "user",
    name: "普通读者",
    description: "默认读者身份。",
    builtInRole: UserRole.USER,
    rank: 1
  },
  {
    key: "svip",
    name: "SVIP",
    description: "标准 VIP 读者身份。",
    builtInRole: UserRole.SVIP,
    rank: 2
  },
  {
    key: "ssvip",
    name: "SSVIP",
    description: "最高可见读者身份。",
    builtInRole: UserRole.SSVIP,
    rank: 3
  }
];

export const publicIdentityKeys = publicIdentityTiers.map((tier) => tier.key);

export const publicIdentityKeySet = new Set<string>(publicIdentityKeys);

export function isPublicIdentityKey(key: string | null | undefined): key is PublicIdentityTierKey {
  return Boolean(key && publicIdentityKeySet.has(key));
}

export function getPublicIdentityTierByKey(key: string | null | undefined) {
  return publicIdentityTiers.find((tier) => tier.key === key) ?? null;
}

export function getPublicIdentityTierByRole(role: UserRole | null | undefined) {
  if (role === UserRole.SSVIP) {
    return getPublicIdentityTierByKey("ssvip");
  }
  if (role === UserRole.SVIP) {
    return getPublicIdentityTierByKey("svip");
  }
  if (role === UserRole.USER) {
    return getPublicIdentityTierByKey("user");
  }
  if (role === UserRole.Administer) {
    return getPublicIdentityTierByKey("ssvip");
  }
  return null;
}

export function getPublicIdentityRank(key: string | null | undefined) {
  return getPublicIdentityTierByKey(key)?.rank ?? 0;
}

export function getVisibleIdentityPermissions(role: UserRole) {
  return getDefaultPermissionsForRole(role);
}

export function sortPublicIdentities<T extends { key: string }>(items: T[]) {
  return [...items].sort((a, b) => getPublicIdentityRank(b.key) - getPublicIdentityRank(a.key));
}
