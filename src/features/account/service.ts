import { z } from "zod";
import { db, getTrustedDeviceDelegate, isDatabaseConfigured, withDatabase } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/security";
import { idSchema, passwordUpdateSchema, profileUpdateSchema } from "@/features/account/validators";

const passkeyRenameSchema = z.object({
  id: z.string().min(1),
  deviceName: z.string().trim().min(1, "Device name is required.").max(80, "Device name is too long.")
});

export async function getAccountData(user: CurrentUser) {
  if (!isDatabaseConfigured()) {
    return {
      sessions: [],
      passkeys: [],
      trustedDevices: [],
      error: "DATABASE_URL is not configured. Account data cannot be loaded."
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
  }, { sessions: [], passkeys: [], trustedDevices: [], error: "Failed to load account data." });
}

export async function updateProfile(user: CurrentUser, input: unknown) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
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
    throw new Error("DATABASE_URL is not configured.");
  }

  const parsed = passwordUpdateSchema.parse(input);
  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true }
  });

  if (!record) {
    throw new Error("User not found.");
  }

  const matches = await verifyPassword(parsed.currentPassword, record.passwordHash);
  if (!matches) {
    throw new Error("Current password is incorrect.");
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.newPassword) }
  });
}

export async function revokeSession(user: CurrentUser, input: unknown) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
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
    throw new Error("DATABASE_URL is not configured.");
  }

  const parsed = idSchema.parse(input);
  const trustedDevice = getTrustedDeviceDelegate();
  if (!trustedDevice) {
    throw new Error("Trusted device storage is not available. Run Prisma generate and migrate first.");
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
    throw new Error("DATABASE_URL is not configured.");
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
    throw new Error("DATABASE_URL is not configured.");
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
