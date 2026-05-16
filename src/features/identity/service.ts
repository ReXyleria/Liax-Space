import { Prisma, SettingType, UserRole } from "@prisma/client";
import { db, isDatabaseConfigured } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { assertPermission, canManageArticles, canManageIdentities, canManageUsers } from "@/lib/permissions";
import { allPermissionKeys } from "@/lib/permission-definitions";
import { identityUpdateSchema } from "@/features/identity/validators";
import {
  getPublicIdentityTierByRole,
  getVisibleIdentityPermissions,
  isPublicIdentityKey,
  publicIdentityKeys,
  publicIdentityTiers,
  sortPublicIdentities
} from "@/features/identity/tiers";

function filterPermissionsForActor(actor: CurrentUser, permissions: string[]) {
  const unique = Array.from(new Set(permissions)).filter((key) => allPermissionKeys.includes(key));

  if (actor.role === UserRole.Administer) {
    return unique;
  }

  return unique.filter((key) => key !== "codeInjection.manage");
}

function userMigrationKeyForIdentity(identity: { key: string; builtInRole: UserRole | null }) {
  if (isPublicIdentityKey(identity.key)) {
    return identity.key;
  }

  const tier = getPublicIdentityTierByRole(identity.builtInRole);
  if (tier) {
    return tier.key;
  }

  return "user";
}

function articleAccessMigrationKeyForIdentity(identity: { key: string; builtInRole: UserRole | null }) {
  if (isPublicIdentityKey(identity.key)) {
    return identity.key;
  }

  const tier = getPublicIdentityTierByRole(identity.builtInRole);
  if (tier) {
    return tier.key;
  }

  return "ssvip";
}

async function normalizeCoreIdentities() {
  await db.$transaction(async (tx) => {
    for (const tier of publicIdentityTiers) {
      await tx.identity.upsert({
        where: { key: tier.key },
        update: {
          name: tier.name,
          builtInRole: tier.builtInRole,
          description: tier.description,
          permissions: getVisibleIdentityPermissions(tier.builtInRole) as Prisma.InputJsonValue
        },
        create: {
          key: tier.key,
          name: tier.name,
          description: tier.description,
          builtInRole: tier.builtInRole,
          permissions: getVisibleIdentityPermissions(tier.builtInRole) as Prisma.InputJsonValue
        }
      });
    }

    const publicIdentities = await tx.identity.findMany({
      where: { key: { in: publicIdentityKeys } },
      select: { id: true, key: true }
    });
    const publicByKey = new Map(publicIdentities.map((identity) => [identity.key, identity.id]));
    const fallbackUserIdentityId = publicByKey.get("user") ?? null;

    const oldIdentities = await tx.identity.findMany({
      where: { key: { notIn: publicIdentityKeys } },
      select: { id: true, key: true, builtInRole: true }
    });

    for (const identity of oldIdentities) {
      const userTargetId = publicByKey.get(userMigrationKeyForIdentity(identity)) ?? fallbackUserIdentityId;
      const accessTargetId = publicByKey.get(articleAccessMigrationKeyForIdentity(identity)) ?? publicByKey.get("ssvip") ?? null;

      await tx.user.updateMany({
        where: { identityId: identity.id },
        data: { identityId: userTargetId }
      });

      const articleAccess = await tx.articleAllowedIdentity.findMany({
        where: { identityId: identity.id },
        select: { articleId: true }
      });

      await tx.articleAllowedIdentity.deleteMany({ where: { identityId: identity.id } });

      if (accessTargetId && articleAccess.length) {
        await tx.articleAllowedIdentity.createMany({
          data: articleAccess.map((item) => ({
            articleId: item.articleId,
            identityId: accessTargetId
          })),
          skipDuplicates: true
        });
      }

      await tx.setting.updateMany({
        where: { key: "register.defaultIdentityId", value: identity.id },
        data: { value: userTargetId ?? "" }
      });

      await tx.identity.delete({ where: { id: identity.id } });
    }

    if (fallbackUserIdentityId) {
      const defaultSetting = await tx.setting.findUnique({
        where: { key: "register.defaultIdentityId" },
        select: { value: true }
      });
      if (!defaultSetting?.value || !publicByKey.has(
        publicIdentities.find((identity) => identity.id === defaultSetting.value)?.key ?? ""
      )) {
        await tx.setting.upsert({
          where: { key: "register.defaultIdentityId" },
          update: { value: fallbackUserIdentityId },
          create: {
            key: "register.defaultIdentityId",
            value: fallbackUserIdentityId,
            group: "identity",
            type: SettingType.TEXT
          }
        });
      }
    }
  });
}

export async function ensureBuiltInIdentities() {
  if (!isDatabaseConfigured()) {
    return;
  }

  await normalizeCoreIdentities();
}

export async function listIdentities(user: CurrentUser) {
  assertPermission(canManageIdentities(user), "你没有权限管理身份。");

  if (!isDatabaseConfigured()) {
    return { identities: [], error: "DATABASE_URL 未配置。" };
  }

  try {
    await ensureBuiltInIdentities();
    const identities = await db.identity.findMany({
      where: { key: { in: publicIdentityKeys } },
      include: {
        _count: {
          select: { users: true }
        }
      }
    });

    return {
      identities: sortPublicIdentities(identities),
      error: null
    };
  } catch (error) {
    console.error("加载身份列表失败", error);
    return { identities: [], error: "加载身份失败。" };
  }
}

export async function listAssignableIdentities(user: CurrentUser) {
  assertPermission(canManageUsers(user), "你没有权限分配身份。");

  if (!isDatabaseConfigured()) {
    return [];
  }

  await ensureBuiltInIdentities();
  const identities = await db.identity.findMany({
    where: { key: { in: publicIdentityKeys } },
    select: {
      id: true,
      name: true,
      key: true,
      builtInRole: true
    }
  });

  return sortPublicIdentities(identities);
}

export async function listArticleViewerIdentities(user: CurrentUser) {
  assertPermission(canManageArticles(user), "你没有权限配置文章可见身份。");

  if (!isDatabaseConfigured()) {
    return [];
  }

  await ensureBuiltInIdentities();
  const identities = await db.identity.findMany({
    where: { key: { in: publicIdentityKeys } },
    select: {
      id: true,
      name: true,
      key: true,
      builtInRole: true
    }
  });

  return sortPublicIdentities(identities);
}

export async function createIdentity(_user: CurrentUser, _input: unknown) {
  void _user;
  void _input;
  throw new Error("可见身份固定为 SSVIP、SVIP 和普通读者。");
}

export async function updateIdentity(user: CurrentUser, input: unknown) {
  assertPermission(canManageIdentities(user), "你没有权限更新身份。");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const parsed = identityUpdateSchema.parse(input);
  const target = await db.identity.findUnique({ where: { id: parsed.id } });

  if (!target) {
    throw new Error("未找到身份。");
  }

  if (!isPublicIdentityKey(target.key)) {
    throw new Error("站长是隐藏的 Administer 等级，旧身份不可编辑。")
  }

  const permissions = filterPermissionsForActor(user, parsed.permissions);

  return db.identity.update({
    where: { id: parsed.id },
    data: {
      key: target.key,
      name: target.name,
      description: parsed.description || null,
      permissions: permissions as Prisma.InputJsonValue
    }
  });
}

export async function deleteIdentity(
  _user: CurrentUser,
  _id: string,
  _options: { confirmUsed: boolean; migrationTargetIdentityId?: string | null }
) {
  void _user;
  void _id;
  void _options;
  throw new Error("核心身份不能删除。可见身份集合固定为 SSVIP、SVIP 和普通读者。");
}
