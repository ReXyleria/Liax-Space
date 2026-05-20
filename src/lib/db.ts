import { Prisma, PrismaClient } from "@prisma/client";

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

export type DatabaseConfigDiagnostics = {
  configured: boolean;
  source: "DATABASE_URL" | "MYSQL_*" | "none";
  host?: string;
  port?: string;
  database?: string;
  user?: string;
  missingMysqlEnv: string[];
  databaseUrlInvalid?: boolean;
};

function readDatabaseUrlParts() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    return {
      host: url.hostname || undefined,
      port: url.port || undefined,
      database: url.pathname ? decodeURIComponent(url.pathname.replace(/^\//, "")) : undefined,
      user: url.username ? decodeURIComponent(url.username) : undefined,
      invalid: false
    };
  } catch {
    return { invalid: true };
  }
}

export function getDatabaseConfigDiagnostics(): DatabaseConfigDiagnostics {
  const requiredMysqlEnv = ["MYSQL_HOST", "MYSQL_DATABASE", "MYSQL_USER", "MYSQL_PASSWORD"] as const;
  const missingMysqlEnv = requiredMysqlEnv.filter((key) => !process.env[key]?.trim());
  const databaseUrlParts = readDatabaseUrlParts();

  if (process.env.DATABASE_URL) {
    return {
      configured: true,
      source: "DATABASE_URL",
      host: databaseUrlParts?.invalid ? undefined : databaseUrlParts?.host,
      port: databaseUrlParts?.invalid ? undefined : databaseUrlParts?.port,
      database: databaseUrlParts?.invalid ? undefined : databaseUrlParts?.database,
      user: databaseUrlParts?.invalid ? undefined : databaseUrlParts?.user,
      missingMysqlEnv,
      databaseUrlInvalid: Boolean(databaseUrlParts?.invalid)
    };
  }

  return {
    configured: false,
    source: missingMysqlEnv.length ? "none" : "MYSQL_*",
    host: process.env.MYSQL_HOST || undefined,
    port: process.env.MYSQL_PORT || "3306",
    database: process.env.MYSQL_DATABASE || undefined,
    user: process.env.MYSQL_USER || undefined,
    missingMysqlEnv
  };
}

export type DatabaseTableReadiness = {
  ready: boolean;
  existing: string[];
  missing: string[];
};

export async function getDatabaseTableReadiness(tableNames: string[]): Promise<DatabaseTableReadiness> {
  const uniqueTableNames = Array.from(new Set(tableNames.filter(Boolean)));
  if (!uniqueTableNames.length) {
    return { ready: true, existing: [], missing: [] };
  }

  const diagnostics = getDatabaseConfigDiagnostics();
  if (!isDatabaseConfigured() || !diagnostics.database || diagnostics.databaseUrlInvalid) {
    return { ready: false, existing: [], missing: uniqueTableNames };
  }

  const rows = await db.$queryRaw<Array<{ tableName: string }>>`
    SELECT TABLE_NAME AS tableName
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = ${diagnostics.database}
      AND TABLE_NAME IN (${Prisma.join(uniqueTableNames)})
  `;
  const existing = rows.map((row) => row.tableName);
  const existingSet = new Set(existing.map((tableName) => tableName.toLowerCase()));
  const missing = uniqueTableNames.filter((tableName) => !existingSet.has(tableName.toLowerCase()));

  return {
    ready: missing.length === 0,
    existing,
    missing
  };
}

export async function databaseTablesExist(tableNames: string[]) {
  return (await getDatabaseTableReadiness(tableNames)).ready;
}

export function getDatabaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const maybePrismaError = error as { code?: unknown; errorCode?: unknown };
  return typeof maybePrismaError.code === "string"
    ? maybePrismaError.code
    : typeof maybePrismaError.errorCode === "string"
      ? maybePrismaError.errorCode
      : undefined;
}

export function getDatabaseErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function describeDatabaseError(error: unknown) {
  const code = getDatabaseErrorCode(error);
  const message = getDatabaseErrorMessage(error);

  if (code === "P1000") {
    return "数据库认证失败，请检查 MYSQL_USER / MYSQL_PASSWORD 或 DATABASE_URL 用户名密码。";
  }

  if (code === "P1001") {
    return "无法连接数据库服务器，请检查 MYSQL_HOST、MYSQL_PORT、容器网络和 MySQL 是否已启动。";
  }

  if (code === "P1002") {
    return "数据库连接超时，请检查 MySQL 启动状态、端口、防火墙或服务器负载。";
  }

  if (code === "P1003" || isMissingDatabaseError(error)) {
    return "目标数据库不存在，请检查 MYSQL_DATABASE 是否已创建。";
  }

  if (code === "P1017") {
    return "数据库连接被服务器关闭，请检查 MySQL 日志和连接限制。";
  }

  if (message.includes("timed out")) {
    return message;
  }

  return message || "数据库连接失败。";
}

export function getDatabaseLogDetails(error?: unknown) {
  const diagnostics = getDatabaseConfigDiagnostics();
  return {
    configured: diagnostics.configured,
    source: diagnostics.source,
    host: diagnostics.host,
    port: diagnostics.port,
    database: diagnostics.database,
    user: diagnostics.user,
    missingMysqlEnv: diagnostics.missingMysqlEnv,
    databaseUrlInvalid: diagnostics.databaseUrlInvalid,
    errorCode: error ? getDatabaseErrorCode(error) : undefined,
    errorName: error instanceof Error ? error.name : undefined,
    errorMessage: error ? getDatabaseErrorMessage(error) : undefined,
    errorStack: error instanceof Error ? error.stack : undefined
  };
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

  const code = getDatabaseErrorCode(error);
  if (code === "P1003") {
    return true;
  }

  return error instanceof Error && error.message.includes("Database `") && error.message.includes("does not exist");
}
