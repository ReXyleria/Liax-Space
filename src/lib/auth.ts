import { cookies } from "next/headers";
import { UserStatus, type User } from "@prisma/client";
import { db, getTrustedDeviceDelegate, isDatabaseConfigured } from "@/lib/db";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  TRUSTED_DEVICE_COOKIE_NAME,
  TRUSTED_DEVICE_MAX_AGE_SECONDS
} from "@/lib/constants";
import { generateOpaqueToken, hashToken } from "@/lib/security";

export class AuthError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthError";
  }
}

export type CurrentUser = Pick<
  User,
  "id" | "email" | "username" | "nickname" | "avatar" | "role" | "status" | "emailVerified" | "totpEnabled" | "totpConfirmedAt" | "createdAt" | "lastLoginAt"
> & {
  identity: {
    id: string;
    key: string;
    name: string;
    builtInRole: User["role"] | null;
    permissions: unknown;
  } | null;
};

function getCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
    maxAge: SESSION_MAX_AGE_SECONDS
  };
}

export async function createSession(userId: string, deviceName?: string) {
  if (!isDatabaseConfigured()) {
    throw new AuthError("Database is not configured.");
  }

  const token = generateOpaqueToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.authSession.create({
    data: {
      userId,
      tokenHash,
      deviceName,
      expiresAt
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getCookieOptions(expiresAt));
}

export async function createTrustedDevice(userId: string, deviceName?: string) {
  if (!isDatabaseConfigured()) {
    throw new AuthError("Database is not configured.");
  }

  const token = generateOpaqueToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_MAX_AGE_SECONDS * 1000);
  const trustedDevice = getTrustedDeviceDelegate();

  if (!trustedDevice) {
    return;
  }

  await trustedDevice.create({
    data: {
      userId,
      tokenHash,
      deviceName,
      expiresAt
    }
  });

  const cookieStore = await cookies();
  cookieStore.set(TRUSTED_DEVICE_COOKIE_NAME, token, getCookieOptions(expiresAt));
}

export async function resolveTrustedDevice(userId: string) {
  if (!isDatabaseConfigured()) {
    return null;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(TRUSTED_DEVICE_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const trustedDevice = getTrustedDeviceDelegate();
  if (!trustedDevice) {
    return null;
  }

  const record = await trustedDevice.findFirst({
    where: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: { gt: new Date() }
    }
  });

  if (!record) {
    cookieStore.delete(TRUSTED_DEVICE_COOKIE_NAME);
    return null;
  }

  await trustedDevice
    .update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() }
    })
    .catch(() => undefined);

  return record;
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token && isDatabaseConfigured()) {
    await db.authSession
      .deleteMany({
        where: { tokenHash: hashToken(token) }
      })
      .catch((error) => {
        console.error("Failed to delete session", error);
      });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isDatabaseConfigured()) {
    return null;
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const session = await db.authSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            nickname: true,
            avatar: true,
            role: true,
            status: true,
            emailVerified: true,
            totpEnabled: true,
            totpConfirmedAt: true,
            createdAt: true,
            lastLoginAt: true,
            identity: {
              select: {
                id: true,
                key: true,
                name: true,
                builtInRole: true,
                permissions: true
              }
            }
          }
        }
      }
    });

    if (!session || session.expiresAt <= new Date()) {
      return null;
    }

    if (session.user.status !== UserStatus.ACTIVE) {
      return null;
    }

    await db.authSession
      .update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() }
      })
      .catch(() => undefined);

    return session.user;
  } catch (error) {
    console.error("Failed to resolve current user", error);
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthError();
  }

  return user;
}
