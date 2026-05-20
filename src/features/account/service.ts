import { z } from "zod";
import { db, getTrustedDeviceDelegate, isDatabaseConfigured, withDatabase } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/security";
import { idSchema, passwordUpdateSchema, profileUpdateSchema } from "@/features/account/validators";

const passkeyRenameSchema = z.object({
  id: z.string().min(1),
  deviceName: z.string().trim().min(1, "设备名称不能为空。").max(80, "设备名称不能超过 80 个字符。")
});

export async function getAccountData(user: CurrentUser) {
  if (!isDatabaseConfigured()) {
    return {
      sessions: [],
      passkeys: [],
      trustedDevices: [],
      error: "DATABASE_URL 未配置，无法加载账号数据。"
    };
  }

  return withDatabase(async () => {
    const trustedDevice = getTrustedDeviceDelegate();
    const [sessions, passkeys, trustedDevices] = await Promise.all([
      db.authSession.findMany({
        where: { userId: user.id },
        orderBy: { lastUsedAt: "desc" },
        select: {
          id: true,
          deviceName: true,
          createdAt: true,
          lastUsedAt: true,
          expiresAt: true
        }
      }),
      db.passkeyCredential.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          deviceName: true,
          createdAt: true,
          lastUsedAt: true
        }
      }),
      trustedDevice
        ? trustedDevice.findMany({
            where: { userId: user.id },
            orderBy: { lastUsedAt: "desc" },
            select: {
              id: true,
              deviceName: true,
              createdAt: true,
              lastUsedAt: true,
              expiresAt: true
            }
          })
        : Promise.resolve([])
    ]);

    return { sessions, passkeys, trustedDevices, error: null as string | null };
  }, { sessions: [], passkeys: [], trustedDevices: [], error: "账号数据加载失败。" });
}

export async function updateProfile(user: CurrentUser, input: unknown) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const parsed = profileUpdateSchema.parse(input);
  return db.user.update({
    where: { id: user.id },
    data: {
      nickname: parsed.nickname,
      avatar: parsed.avatar || null
    }
  });
}

export async function updatePassword(user: CurrentUser, input: unknown) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const parsed = passwordUpdateSchema.parse(input);
  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true }
  });

  if (!record) {
    throw new Error("用户不存在。");
  }

  const matches = await verifyPassword(parsed.currentPassword, record.passwordHash);
  if (!matches) {
    throw new Error("当前密码不正确。");
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.newPassword) }
  });
}

export async function revokeSession(user: CurrentUser, input: unknown) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const parsed = idSchema.parse(input);
  await db.authSession.deleteMany({
    where: {
      id: parsed.id,
      userId: user.id
    }
  });
}

export async function revokeTrustedDevice(user: CurrentUser, input: unknown) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const parsed = idSchema.parse(input);
  const trustedDevice = getTrustedDeviceDelegate();
  if (!trustedDevice) {
    throw new Error("可信设备数据表不可用，请先运行 Prisma generate 和数据库迁移。");
  }

  await trustedDevice.deleteMany({
    where: {
      id: parsed.id,
      userId: user.id
    }
  });
}

export async function deletePasskey(user: CurrentUser, input: unknown) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const parsed = idSchema.parse(input);
  await db.passkeyCredential.deleteMany({
    where: {
      id: parsed.id,
      userId: user.id
    }
  });
}

export async function renamePasskey(user: CurrentUser, input: unknown) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const parsed = passkeyRenameSchema.parse(input);
  await db.passkeyCredential.updateMany({
    where: {
      id: parsed.id,
      userId: user.id
    },
    data: {
      deviceName: parsed.deviceName
    }
  });
}
