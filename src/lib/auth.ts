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
  "id" | "email" | "username" | "nickname" | "avatar" | "role" | "status" | "mutedUntil" | "emailVerified" | "totpEnabled" | "totpConfirmedAt" | "createdAt" | "lastLoginAt"
> & {
  identity: {
    id: string;
    key: string;
    name: string;
    builtInRole: User["role"] | null;
    permissions: unknown;
  } | null;
};

type CookieWriteOptions = {
  secure?: boolean;
  maxAge?: number;
};

type CurrentUserOptions = {
  touchSession?: boolean;
};

function readBooleanEnv(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

export function shouldUseSecureCookies(request?: Request) {
  const explicit = readBooleanEnv(process.env.AUTH_COOKIE_SECURE ?? process.env.COOKIE_SECURE);
  if (explicit !== undefined) {
    return explicit;
  }

  const forwardedProto = request?.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (forwardedProto === "https") {
    return true;
  }
  if (forwardedProto === "http") {
    return false;
  }

  if (request?.url) {
    try {
      return new URL(request.url).protocol === "https:";
    } catch {
      return false;
    }
  }

  const configuredUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL;
  if (configuredUrl) {
    try {
      return new URL(configuredUrl).protocol === "https:";
    } catch {
      return false;
    }
  }

  return false;
}

function getCookieOptions(expires: Date, options: CookieWriteOptions = {}) {
  return {
    httpOnly: true,
    secure: options.secure ?? shouldUseSecureCookies(),
    sameSite: "lax" as const,
    path: "/",
    expires,
    maxAge: options.maxAge ?? SESSION_MAX_AGE_SECONDS
  };
}

export async function createSession(userId: string, deviceName?: string, options: CookieWriteOptions = {}) {
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
  cookieStore.set(SESSION_COOKIE_NAME, token, getCookieOptions(expiresAt, options));
}

export async function createTrustedDevice(userId: string, deviceName?: string, options: CookieWriteOptions = {}) {
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
  cookieStore.set(
    TRUSTED_DEVICE_COOKIE_NAME,
    token,
    getCookieOptions(expiresAt, { ...options, maxAge: TRUSTED_DEVICE_MAX_AGE_SECONDS })
  );
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

export async function getCurrentUser(options: CurrentUserOptions = {}): Promise<CurrentUser | null> {
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
            mutedUntil: true,
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

    if (options.touchSession ?? true) {
      await db.authSession
        .update({
          where: { id: session.id },
          data: { lastUsedAt: new Date() }
        })
        .catch(() => undefined);
    }

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
