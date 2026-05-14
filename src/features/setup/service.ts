import "server-only";

import { randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { PrismaClient, UserRole } from "@prisma/client";
import { z } from "zod";
import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";

const storageRoot = process.env.APP_STORAGE_DIR || path.join(process.cwd(), "storage");
const configDir = process.env.SETUP_CONFIG_DIR || path.join(storageRoot, "config");
const runtimeEnvPath = path.join(configDir, "runtime.env");
const setupStatusPath = path.join(configDir, "setup-status.json");
const setupTokenPath = path.join(configDir, "setup-token");

const setupSchema = z
  .object({
    setupToken: z.string().trim().min(16, "安装令牌不正确。"),
    dbHost: z.string().trim().min(1, "请输入数据库主机。").max(255, "数据库主机过长。"),
    dbPort: z.coerce.number().int().min(1, "端口无效。").max(65535, "端口无效。"),
    dbName: z
      .string()
      .trim()
      .min(1, "请输入数据库名。")
      .max(80, "数据库名过长。")
      .regex(/^[a-zA-Z0-9_-]+$/, "数据库名只能包含字母、数字、下划线或短横线。"),
    dbUser: z.string().trim().min(1, "请输入数据库用户名。").max(120, "数据库用户名过长。"),
    dbPassword: z.string().min(1, "请输入数据库密码。"),
    siteUrl: z.string().trim().url("请输入有效的网站域名，例如 https://example.com。"),
    ownerEmail: z.string().trim().email("请输入有效的管理员邮箱。"),
    ownerUsername: z
      .string()
      .trim()
      .min(3, "管理员用户名至少 3 个字符。")
      .max(32, "管理员用户名不能超过 32 个字符。")
      .regex(/^[a-zA-Z0-9_]+$/, "管理员用户名只能包含字母、数字和下划线。"),
    ownerNickname: z.string().trim().min(2, "管理员昵称至少 2 个字符。").max(32, "管理员昵称过长。"),
    ownerPassword: z
      .string()
      .min(8, "管理员密码至少 8 个字符。")
      .regex(/[A-Za-z]/, "管理员密码必须包含字母。")
      .regex(/\d/, "管理员密码必须包含数字。"),
    confirmPassword: z.string().min(1, "请再次输入管理员密码。")
  })
  .refine((data) => data.ownerPassword === data.confirmPassword, {
    message: "两次输入的管理员密码不一致。",
    path: ["confirmPassword"]
  });

type SetupStatusFile = {
  state: "pending-restart" | "complete" | "migration-failed";
  updatedAt: string;
  siteUrl?: string;
  databaseHost?: string;
  databaseName?: string;
  error?: string;
};

type RuntimeEnv = Record<string, string>;

type SetupCheck = {
  completed: boolean;
  databaseConfigured: boolean;
  databaseReachable: boolean;
  hasOwner: boolean;
  canInstall: boolean;
  tokenReady: boolean;
  runtimeConfig: {
    siteUrl?: string;
    databaseHost?: string;
    databaseName?: string;
  };
  status?: SetupStatusFile;
  error?: string;
};

const globalSetupState = globalThis as typeof globalThis & {
  setupAttempts?: Map<string, { count: number; resetAt: number }>;
};

function getClientAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function normalizeSiteUrl(value: string) {
  const url = new URL(value);
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function buildDatabaseUrl(input: z.infer<typeof setupSchema>) {
  const user = encodeURIComponent(input.dbUser);
  const password = encodeURIComponent(input.dbPassword);
  const database = encodeURIComponent(input.dbName);
  return `mysql://${user}:${password}@${input.dbHost}:${input.dbPort}/${database}`;
}

function getRpId(siteUrl: string) {
  try {
    return new URL(siteUrl).hostname || "localhost";
  } catch {
    return "localhost";
  }
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function serializeRuntimeEnv(values: RuntimeEnv) {
  return `${Object.entries(values)
    .map(([key, value]) => `${key}=${shellQuote(value)}`)
    .join("\n")}\n`;
}

function parseRuntimeEnv(content: string): RuntimeEnv {
  const result: RuntimeEnv = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index <= 0) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1).replace(/'\\''/g, "'");
    } else if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

async function ensureConfigDir() {
  await mkdir(configDir, { recursive: true });
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function readRuntimeEnv() {
  try {
    return parseRuntimeEnv(await readFile(runtimeEnvPath, "utf8"));
  } catch {
    return {};
  }
}

async function writeSetupStatus(status: SetupStatusFile) {
  await ensureConfigDir();
  await writeFile(setupStatusPath, `${JSON.stringify(status, null, 2)}\n`, { mode: 0o600 });
}

async function getOrCreateSetupToken() {
  if (process.env.SETUP_TOKEN?.trim()) {
    return process.env.SETUP_TOKEN.trim();
  }

  await ensureConfigDir();

  try {
    const token = (await readFile(setupTokenPath, "utf8")).trim();
    if (token.length >= 16) {
      return token;
    }
  } catch {
    // Create below.
  }

  const token = randomBytes(24).toString("hex");
  await writeFile(setupTokenPath, `${token}\n`, { mode: 0o600 });
  console.warn(`[setup] Generated one-time setup token. Read it from ${setupTokenPath}.`);
  return token;
}

function checkRateLimit(request: Request) {
  const now = Date.now();
  const key = getClientAddress(request);
  const attempts = globalSetupState.setupAttempts ?? new Map<string, { count: number; resetAt: number }>();
  globalSetupState.setupAttempts = attempts;

  const existing = attempts.get(key);
  if (!existing || existing.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return;
  }

  existing.count += 1;
  if (existing.count > 10) {
    throw new Error("安装尝试次数过多，请稍后再试。");
  }
}

async function getOwnerState() {
  if (!isDatabaseConfigured()) {
    return { reachable: false, hasOwner: false, error: undefined };
  }

  const result = await withDatabase<{ reachable: boolean; hasOwner: boolean; error?: string }>(
    async () => {
      const count = await db.user.count({ where: { role: UserRole.OWNER } });
      return { reachable: true, hasOwner: count > 0, error: undefined };
    },
    { reachable: false, hasOwner: false, error: "数据库暂不可用。" }
  );

  return result;
}

export async function getSetupStatus(): Promise<SetupCheck> {
  const [runtimeEnv, status, token] = await Promise.all([
    readRuntimeEnv(),
    readJsonFile<SetupStatusFile>(setupStatusPath),
    getOrCreateSetupToken().then(() => true).catch(() => false)
  ]);
  const ownerState = await getOwnerState();
  const databaseConfigured = isDatabaseConfigured();
  const completed = Boolean(status?.state === "complete" || ownerState.hasOwner);
  const databaseHost =
    runtimeEnv.MYSQL_HOST ||
    (runtimeEnv.DATABASE_URL ? safeDatabaseHost(runtimeEnv.DATABASE_URL) : process.env.MYSQL_HOST || undefined);
  const databaseName =
    runtimeEnv.MYSQL_DATABASE ||
    (runtimeEnv.DATABASE_URL ? safeDatabaseName(runtimeEnv.DATABASE_URL) : process.env.MYSQL_DATABASE || undefined);
  const siteUrl = runtimeEnv.SITE_URL || process.env.SITE_URL || undefined;

  return {
    completed,
    databaseConfigured,
    databaseReachable: ownerState.reachable,
    hasOwner: ownerState.hasOwner,
    canInstall: !completed || !ownerState.reachable || status?.state === "migration-failed",
    tokenReady: token,
    runtimeConfig: {
      siteUrl,
      databaseHost,
      databaseName
    },
    status: status ?? undefined,
    error: status?.error || ownerState.error
  };
}

function safeDatabaseHost(databaseUrl: string) {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return undefined;
  }
}

function safeDatabaseName(databaseUrl: string) {
  try {
    return new URL(databaseUrl).pathname.replace(/^\//, "") || undefined;
  } catch {
    return undefined;
  }
}

async function assertSetupAllowed() {
  const status = await getSetupStatus();
  if (status.completed && status.databaseReachable && status.hasOwner) {
    throw new Error("系统已经完成安装，不能再次修改启动配置。");
  }
}

async function testDatabaseConnection(databaseUrl: string) {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    },
    log: ["error"]
  });

  try {
    await prisma.$queryRaw`SELECT 1`;
  } finally {
    await prisma.$disconnect();
  }
}

export async function submitSetup(input: unknown, request: Request) {
  checkRateLimit(request);

  const parsed = setupSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "请修正表单中的错误。",
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }

  const token = await getOrCreateSetupToken();
  if (parsed.data.setupToken !== token) {
    return {
      ok: false,
      message: "安装令牌不正确。请查看容器日志或 storage/config/setup-token。"
    };
  }

  try {
    await assertSetupAllowed();
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "当前系统不允许重新安装。"
    };
  }

  const siteUrl = normalizeSiteUrl(parsed.data.siteUrl);
  const databaseUrl = buildDatabaseUrl(parsed.data);

  try {
    await testDatabaseConnection(databaseUrl);
  } catch {
    return {
      ok: false,
      message: "数据库连接失败。请确认主机、端口、数据库名、用户名和密码正确，且数据库已经创建。"
    };
  }

  await ensureConfigDir();
  const runtimeEnv: RuntimeEnv = {
    DATABASE_URL: databaseUrl,
    MYSQL_HOST: parsed.data.dbHost,
    MYSQL_PORT: String(parsed.data.dbPort),
    MYSQL_DATABASE: parsed.data.dbName,
    MYSQL_USER: parsed.data.dbUser,
    SITE_URL: siteUrl,
    OWNER_EMAIL: parsed.data.ownerEmail.toLowerCase(),
    OWNER_USERNAME: parsed.data.ownerUsername,
    OWNER_PASSWORD: parsed.data.ownerPassword,
    OWNER_NICKNAME: parsed.data.ownerNickname,
    PASSKEY_RP_ID: getRpId(siteUrl),
    PASSKEY_ORIGIN: siteUrl,
    PASSKEY_RP_NAME: "Liax-Space",
    SETUP_PENDING_RESTART: "true",
    RUN_BOOTSTRAP: "true"
  };

  await writeFile(runtimeEnvPath, serializeRuntimeEnv(runtimeEnv), { mode: 0o600 });
  await writeSetupStatus({
    state: "pending-restart",
    updatedAt: new Date().toISOString(),
    siteUrl,
    databaseHost: parsed.data.dbHost,
    databaseName: parsed.data.dbName
  });

  const shouldRestart = process.env.NODE_ENV === "production" || process.env.SETUP_RESTART_ON_SAVE === "true";
  if (shouldRestart && process.env.SETUP_DISABLE_RESTART !== "true") {
    setTimeout(() => {
      console.warn("[setup] Runtime configuration saved. Exiting so the container can restart with the new config.");
      process.exit(0);
    }, 500);
  }

  return {
    ok: true,
    message: shouldRestart
      ? "配置已保存，服务正在重启并执行数据库迁移。请稍后刷新页面。"
      : "配置已保存。当前为开发模式，请手动重启服务以加载新配置。",
    restart: shouldRestart
  };
}
