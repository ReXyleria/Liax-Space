import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export async function withDatabase<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  if (!isDatabaseConfigured()) {
    return fallback;
  }

  try {
    const timeoutMs = Number(process.env.DATABASE_TIMEOUT_MS || 1200);
    return await Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(`Database operation timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } catch (error) {
    if (isMissingDatabaseError(error)) {
      return fallback;
    }

    console.error("Database operation failed", error);
    return fallback;
  }
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

type TrustedDeviceDelegate = PrismaClient["trustedDevice"];

export function getTrustedDeviceDelegate(): TrustedDeviceDelegate | null {
  const client = db as PrismaClient & { trustedDevice?: TrustedDeviceDelegate };
  return client.trustedDevice ?? null;
}

export function isMissingDatabaseError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybePrismaError = error as { code?: unknown; errorCode?: unknown };
  if (maybePrismaError.code === "P1003" || maybePrismaError.errorCode === "P1003") {
    return true;
  }

  return error instanceof Error && error.message.includes("Database `") && error.message.includes("does not exist");
}
