import { MediaReferenceSource, UserRole, UserStatus } from "@prisma/client";
import { db, getTrustedDeviceDelegate, isDatabaseConfigured, isMissingDatabaseError } from "@/lib/db";
import { assertPermission, canManageUsers } from "@/lib/permissions";
import { getRoleRank } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/security";
import { userSessionDeleteSchema } from "@/features/identity/validators";
import { userCreateSchema, userUpdateSchema } from "@/features/users/validators";
import { isPublicIdentityKey } from "@/features/identity/tiers";

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && Object.values(UserRole).includes(value as UserRole);
}

async function getDefaultRegistrationRole() {
  const setting = await db.setting.findUnique({
    where: { key: "register.defaultRole" },
    select: { value: true }
  });

  return isUserRole(setting?.value) && setting.value !== UserRole.OWNER ? setting.value : UserRole.USER;
}

export async function listUsers(
  user: CurrentUser,
  query = "",
  filters: { role?: string; status?: string; identityId?: string } = {}
) {
  assertPermission(canManageUsers(user), "你没有权限管理用户。");

  if (!isDatabaseConfigured()) {
    return { users: [], error: "DATABASE_URL 未配置。" };
  }

  try {
    const categoryFilters = [
      filters.role ? { role: filters.role as UserRole } : {},
      filters.status ? { status: filters.status as UserStatus } : {},
      filters.identityId ? { identityId: filters.identityId } : {}
    ];

    return {
      users: await db.user.findMany({
        where: query
          ? {
              AND: [
                {
                  OR: [
                    { email: { contains: query } },
                    { username: { contains: query } },
                    { nickname: { contains: query } }
                  ]
                },
                ...categoryFilters
              ]
            }
          : {
              ...(filters.role ? { role: filters.role as UserRole } : {}),
              ...(filters.status ? { status: filters.status as UserStatus } : {}),
              ...(filters.identityId ? { identityId: filters.identityId } : {})
            },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          username: true,
          nickname: true,
          role: true,
          identityId: true,
          identity: {
            select: {
              id: true,
              name: true,
              key: true
            }
          },
          status: true,
          createdAt: true,
          lastLoginAt: true,
          sessions: {
            select: {
              id: true,
              deviceName: true,
              lastUsedAt: true,
              expiresAt: true
            },
            orderBy: { lastUsedAt: "desc" }
          }
        }
      }),
      error: null
    };
  } catch (error) {
    console.error("加载用户列表失败", error);
    return { users: [], error: "加载用户失败。" };
  }
}

export async function getOwnerProfile() {
  if (!isDatabaseConfigured()) {
    return { profile: null, error: "DATABASE_URL 未配置。" };
  }

  try {
    const owner = await db.user.findFirst({
      where: {
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        email: true,
        role: true
      }
    });

    if (owner) {
      return { profile: owner, error: null as string | null };
    }

    const admin = await db.user.findFirst({
      where: {
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        email: true,
        role: true
      }
    });

    return { profile: admin ?? null, error: null as string | null };
  } catch (error) {
    if (isMissingDatabaseError(error)) {
      return { profile: null, error: null as string | null };
    }

    console.error("解析站点负责人失败", error);
    return { profile: null, error: "加载站点负责人失败。" };
  }
}

export async function updateUserRoleStatus(user: CurrentUser, input: unknown) {
  assertPermission(canManageUsers(user), "你没有权限管理用户。");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const parsed = userUpdateSchema.parse(input);
  const target = await db.user.findUnique({ where: { id: parsed.id } });

  if (!target) {
    throw new Error("未找到用户。");
  }

  if (target.role === UserRole.OWNER && user.role !== UserRole.OWNER) {
    throw new Error("只有站长可以修改另一位站长。");
  }

  const identityId = parsed.identityId || null;
  const identity = identityId
    ? await db.identity.findUnique({
        where: { id: identityId },
        select: { id: true, key: true, builtInRole: true }
      })
    : null;

  if (identityId && (!identity || !isPublicIdentityKey(identity.key))) {
    throw new Error("未找到身份。");
  }

  if (user.role !== UserRole.OWNER && getRoleRank(target.role) >= getRoleRank(user.role)) {
    throw new Error("你不能修改权限相同或更高的用户。");
  }

  const effectiveRole = identity?.builtInRole ?? target.role;

  if (effectiveRole === UserRole.OWNER && user.role !== UserRole.OWNER) {
    throw new Error("只有站长可以分配站长系统等级。");
  }

  if (target.role === UserRole.OWNER && (effectiveRole !== UserRole.OWNER || parsed.status !== UserStatus.ACTIVE)) {
    const ownerCount = await db.user.count({
      where: {
        role: UserRole.OWNER,
        status: UserStatus.ACTIVE
      }
    });

    if (ownerCount <= 1) {
      throw new Error("不能禁用或降级最后一位在线站长。");
    }
  }

  return db.user.update({
    where: { id: parsed.id },
    data: {
      email: parsed.email,
      nickname: parsed.nickname,
      ...(parsed.password ? { passwordHash: await hashPassword(parsed.password) } : {}),
      role: effectiveRole,
      identityId,
      status: parsed.status
    }
  });
}

export async function createManagedUser(user: CurrentUser, input: unknown) {
  assertPermission(canManageUsers(user), "你没有权限创建用户。");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const parsed = userCreateSchema.parse(input);

  const existing = await db.user.findFirst({
    where: {
      OR: [
        { email: parsed.email },
        { username: parsed.username }
      ]
    },
    select: { id: true }
  });

  if (existing) {
    throw new Error("邮箱或用户名已被使用。");
  }

  const identity = parsed.identityId
    ? await db.identity.findUnique({
        where: { id: parsed.identityId },
        select: { id: true, key: true, builtInRole: true }
      })
    : null;

  if (parsed.identityId && (!identity || !isPublicIdentityKey(identity.key))) {
    throw new Error("未找到身份。");
  }

  const defaultRole = await getDefaultRegistrationRole();
  const effectiveRole = identity?.builtInRole ?? defaultRole;

  if (effectiveRole === UserRole.OWNER && user.role !== UserRole.OWNER) {
    throw new Error("只有站长可以创建另一位站长。");
  }

  if (user.role !== UserRole.OWNER && getRoleRank(effectiveRole) >= getRoleRank(user.role)) {
    throw new Error("你不能创建权限相同或更高的用户。");
  }

  return db.user.create({
    data: {
      email: parsed.email,
      username: parsed.username,
      nickname: parsed.nickname,
      passwordHash: await hashPassword(parsed.password),
      role: effectiveRole,
      identityId: parsed.identityId || null,
      status: parsed.status,
      emailVerified: false
    }
  });
}

export async function deleteManagedUser(user: CurrentUser, targetUserId: string) {
  assertPermission(canManageUsers(user), "你没有权限删除用户。");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  if (!targetUserId) {
    throw new Error("需要提供用户 ID。");
  }

  if (targetUserId === user.id) {
    throw new Error("不能在用户管理中删除自己的账号。");
  }

  const target = await db.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, email: true, nickname: true, status: true }
  });

  if (!target) {
    throw new Error("未找到用户。");
  }

  if (target.role === UserRole.OWNER) {
    const activeOwnerCount = await db.user.count({
      where: { role: UserRole.OWNER, status: UserStatus.ACTIVE }
    });

    if (activeOwnerCount <= 1 && target.status === UserStatus.ACTIVE) {
      throw new Error("不能删除或禁用最后一位在线站长。");
    }
  }

  if (user.role !== UserRole.OWNER && getRoleRank(target.role) >= getRoleRank(user.role)) {
    throw new Error("你不能删除权限相同或更高的用户。");
  }

  await db.$transaction(async (tx) => {
    const [articles, moments, comments, versions, uploadedMedia] = await Promise.all([
      tx.article.findMany({ where: { authorId: targetUserId }, select: { id: true } }),
      tx.moment.findMany({ where: { authorId: targetUserId }, select: { id: true } }),
      tx.comment.findMany({ where: { userId: targetUserId }, select: { id: true } }),
      tx.articleVersion.findMany({
        where: {
          OR: [
            { createdById: targetUserId },
            { article: { authorId: targetUserId } }
          ]
        },
        select: { id: true }
      }),
      tx.mediaAsset.findMany({ where: { uploaderId: targetUserId }, select: { id: true } })
    ]);
    const articleIds = articles.map((article) => article.id);
    const momentIds = moments.map((moment) => moment.id);
    const commentsOnOwnedArticles = await tx.comment.findMany({
      where: { articleId: { in: articleIds } },
      select: { id: true }
    });
    const commentIds = Array.from(new Set([
      ...comments.map((comment) => comment.id),
      ...commentsOnOwnedArticles.map((comment) => comment.id)
    ]));
    const versionIds = versions.map((version) => version.id);
    const uploadedMediaIds = uploadedMedia.map((asset) => asset.id);

    await tx.mediaReference.deleteMany({
      where: {
        OR: [
          { source: MediaReferenceSource.ARTICLE, sourceId: { in: articleIds } },
          { source: MediaReferenceSource.MOMENT, sourceId: { in: momentIds } },
          { source: MediaReferenceSource.ARTICLE_VERSION, sourceId: { in: versionIds } },
          { source: MediaReferenceSource.COMMENT, sourceId: { in: commentIds } },
          { source: MediaReferenceSource.USER_AVATAR, sourceId: targetUserId },
          { assetId: { in: uploadedMediaIds } }
        ]
      }
    });
    await tx.articleVersion.deleteMany({
      where: {
        OR: [
          { articleId: { in: articleIds } },
          { createdById: targetUserId }
        ]
      }
    });
    await tx.articleTranslation.deleteMany({ where: { articleId: { in: articleIds } } });
    await tx.articleTag.deleteMany({ where: { articleId: { in: articleIds } } });
    await tx.comment.deleteMany({
      where: {
        OR: [
          { userId: targetUserId },
          { articleId: { in: articleIds } }
        ]
      }
    });
    await tx.visitLog.deleteMany({
      where: {
        OR: [
          { userId: targetUserId },
          { articleId: { in: articleIds } }
        ]
      }
    });
    await tx.momentLike.deleteMany({
      where: {
        OR: [
          { userId: targetUserId },
          { momentId: { in: momentIds } }
        ]
      }
    });
    await tx.momentComment.deleteMany({
      where: {
        OR: [
          { userId: targetUserId },
          { momentId: { in: momentIds } }
        ]
      }
    });
    await tx.moment.deleteMany({ where: { id: { in: momentIds } } });
    await tx.article.deleteMany({ where: { id: { in: articleIds } } });
    await tx.mediaAsset.deleteMany({ where: { id: { in: uploadedMediaIds } } });
    await tx.authSession.deleteMany({ where: { userId: targetUserId } });
    await tx.passkeyCredential.deleteMany({ where: { userId: targetUserId } });
    await tx.totpRecoveryCode.deleteMany({ where: { userId: targetUserId } });
    await tx.webAuthnChallenge.deleteMany({ where: { userId: targetUserId } });
    await tx.pendingAuth.deleteMany({ where: { userId: targetUserId } });
    await tx.trustedDevice.deleteMany({ where: { userId: targetUserId } });
    await tx.verificationCode.deleteMany({ where: { email: target.email } });
    await tx.user.delete({ where: { id: targetUserId } });
  });
}

export async function revokeManagedSession(user: CurrentUser, input: unknown) {
  assertPermission(canManageUsers(user), "你没有权限管理用户会话。");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const parsed = userSessionDeleteSchema.parse(input);
  await db.authSession.deleteMany({
    where: { id: parsed.id }
  });
}

export async function revokeManagedTrustedDevice(user: CurrentUser, input: unknown) {
  assertPermission(canManageUsers(user), "你没有权限管理可信设备。");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const parsed = userSessionDeleteSchema.parse(input);
  const trustedDevice = getTrustedDeviceDelegate();
  if (!trustedDevice) {
    throw new Error("可信设备存储不可用。请先运行 Prisma generate 和 migrate。");
  }

  await trustedDevice.deleteMany({
    where: { id: parsed.id }
  });
}

export async function listAllLoginSessions(user: CurrentUser, query = "") {
  assertPermission(canManageUsers(user), "你没有权限管理用户会话。");
  if (!isDatabaseConfigured()) {
    return { sessions: [], error: "DATABASE_URL 未配置。" };
  }

  try {
    return {
      sessions: await db.authSession.findMany({
        where: query
          ? {
              user: {
                OR: [
                  { email: { contains: query } },
                  { username: { contains: query } },
                  { nickname: { contains: query } }
                ]
              }
            }
          : {},
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              nickname: true,
              role: true
            }
          }
        },
        orderBy: { lastUsedAt: "desc" }
      }),
      error: null
    };
  } catch (error) {
    console.error("加载登录会话失败", error);
    return { sessions: [], error: "加载登录会话失败。" };
  }
}

export async function listAllTrustedDevices(user: CurrentUser, query = "") {
  assertPermission(canManageUsers(user), "你没有权限管理可信设备。");
  if (!isDatabaseConfigured()) {
    return { devices: [], error: "DATABASE_URL 未配置。" };
  }

  try {
    const trustedDevice = getTrustedDeviceDelegate();
    if (!trustedDevice) {
      return {
        devices: [],
        error: "可信设备存储不可用。请先运行 Prisma generate 和 migrate。"
      };
    }

    return {
      devices: await trustedDevice.findMany({
        where: query
          ? {
              user: {
                OR: [
                  { email: { contains: query } },
                  { username: { contains: query } },
                  { nickname: { contains: query } }
                ]
              }
            }
          : {},
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              nickname: true,
              role: true
            }
          }
        },
        orderBy: { lastUsedAt: "desc" }
      }),
      error: null
    };
  } catch (error) {
    console.error("加载可信设备失败", error);
    return { devices: [], error: "加载可信设备失败。" };
  }
}
