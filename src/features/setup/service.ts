import "server-only";

import { randomBytes } from "crypto";
import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus, SettingType } from "@prisma/client";
import { z } from "zod";
import {
  db,
  describeDatabaseError,
  getDatabaseConfigDiagnostics,
  getDatabaseLogDetails,
  getDatabaseTableReadiness,
  isDatabaseConfigured
} from "@/lib/db";

const storageRoot = process.env.APP_STORAGE_DIR || path.join(process.cwd(), "storage");
const configDir = process.env.SETUP_CONFIG_DIR || path.join(storageRoot, "config");
const setupStatusPath = path.join(configDir, "setup-status.json");
const setupTokenPath = path.join(configDir, "setup-token");
const installLockPath = path.join(configDir, "install.lock");

const allPermissionKeys = [
  "articles.manage",
  "comments.manage",
  "moments.manage",
  "tags.manage",
  "users.manage",
  "identities.manage",
  "settings.manage",
  "mailTemplates.manage",
  "codeInjection.manage",
  "backupRestore.manage",
  "analytics.view"
];

const defaultRolePermissions: Record<string, string[]> = {
  USER: [],
  SVIP: [],
  SSVIP: [],
  Administer: allPermissionKeys
};

const setupRequiredTables = ["SystemInstallation", "User", "Setting", "Identity"];

const publicIdentityTiers = [
  { key: "user", name: "user", description: "Default reader identity.", builtInRole: UserRole.USER },
  { key: "svip", name: "svip", description: "Standard VIP reader identity.", builtInRole: UserRole.SVIP },
  { key: "ssvip", name: "ssvip", description: "Top visible reader identity.", builtInRole: UserRole.SSVIP }
];

const defaultSettings: [string, string, string, SettingType][] = [
  ["site.title", "Liax-Space", "basic", SettingType.TEXT],
  ["site.subtitle", "Notes on code and life.", "basic", SettingType.TEXT],
  ["site.url", "http://localhost:3000", "basic", SettingType.TEXT],
  ["site.logo", "", "basic", SettingType.IMAGE],
  ["theme.primary", "#7187f3", "theme", SettingType.TEXT],
  ["theme.accent", "#c8a2ff", "theme", SettingType.TEXT],
  ["appearance.backgroundImage", "", "appearance", SettingType.IMAGE],
  ["appearance.backgroundOverlayOpacity", "30", "appearance", SettingType.NUMBER],
  ["appearance.backgroundBlur", "14", "appearance", SettingType.NUMBER],
  ["site.defaultLanguage", "zh-CN", "basic", SettingType.TEXT],
  ["site.defaultFont", "HarmonyOS Sans", "basic", SettingType.TEXT],
  ["home.heroLine", "A personal notebook built for thoughtful writing.", "home", SettingType.TEXTAREA],
  ["home.cover", "", "home", SettingType.IMAGE],
  ["home.randomBackground", "true", "home", SettingType.BOOLEAN],
  ["home.randomBackgroundUrl", "https://photo.toliax.com/random", "home", SettingType.TEXT],
  ["record.icp", "", "record", SettingType.TEXT],
  ["record.icpUrl", "https://beian.miit.gov.cn/", "record", SettingType.TEXT],
  ["record.police", "", "record", SettingType.TEXT],
  ["record.policeUrl", "https://www.beian.gov.cn/portal/registerSystemInfo", "record", SettingType.TEXT],
  ["footer.copyright", "© Liax-Space", "footer", SettingType.TEXT],
  ["contact.email", "", "contact", SettingType.TEXT],
  ["contact.github", "", "contact", SettingType.TEXT],
  ["contact.bilibili", "", "contact", SettingType.TEXT],
  ["contact.x", "", "contact", SettingType.TEXT],
  ["contact.qq", "", "contact", SettingType.TEXT],
  ["contact.wechatQr", "", "contact", SettingType.IMAGE],
  ["smtp.host", "", "smtp", SettingType.TEXT],
  ["smtp.port", "587", "smtp", SettingType.NUMBER],
  ["smtp.user", "", "smtp", SettingType.TEXT],
  ["smtp.pass", "", "smtp", SettingType.PASSWORD],
  ["smtp.from", "", "smtp", SettingType.TEXT],
  ["smtp.fromName", "", "smtp", SettingType.TEXT],
  ["smtp.encryption", "starttls", "smtp", SettingType.TEXT],
  ["smtp.notificationsEnabled", "true", "smtp", SettingType.BOOLEAN],
  ["register.enabled", "true", "register", SettingType.BOOLEAN],
  ["register.defaultRole", "USER", "identity", SettingType.TEXT],
  ["comments.requireApproval", "true", "comments", SettingType.BOOLEAN],
  ["guestbook.requireApproval", "true", "guestbook", SettingType.BOOLEAN],
  ["translation.enabled", "false", "translation", SettingType.BOOLEAN],
  ["translation.provider", "custom", "translation", SettingType.TEXT],
  ["translation.baseUrl", "", "translation", SettingType.TEXT],
  ["translation.apiKey", "", "translation", SettingType.PASSWORD],
  ["translation.model", "", "translation", SettingType.TEXT],
  ["translation.sourceLang", "zh-CN", "translation", SettingType.TEXT],
  ["translation.targetLang", "en", "translation", SettingType.TEXT],
  ["translation.timeoutMs", "30000", "translation", SettingType.NUMBER],
  ["translation.maxRetries", "2", "translation", SettingType.NUMBER],
  ["translation.autoTranslate", "true", "translation", SettingType.BOOLEAN],
  ["translation.saveResult", "true", "translation", SettingType.BOOLEAN],
  ["translation.chunkingEnabled", "true", "translation", SettingType.BOOLEAN],
  ["translation.maxChunkChars", "3500", "translation", SettingType.NUMBER],
  ["translation.chunkConcurrency", "2", "translation", SettingType.NUMBER]
];

const setupSchema = z
  .object({
    setupToken: z.string().trim().min(16, "安装令牌不正确。"),
    siteUrl: z.string().trim().url("请输入有效的网站域名，例如 https://example.com。"),
    siteTitle: z.string().trim().min(1, "请输入站点标题。").max(120, "站点标题过长。"),
    passkeyRpName: z.string().trim().min(1, "请输入 Passkey RP 名称。").max(120, "Passkey RP 名称过长。"),
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
  state: "complete" | "migration-failed" | "database-url-missing";
  updatedAt: string;
  siteUrl?: string;
  databaseHost?: string;
  databaseName?: string;
  error?: string;
};

function formatDatabaseTarget() {
  const diagnostics = getDatabaseConfigDiagnostics();
  const target = [
    diagnostics.user ? `user=${diagnostics.user}` : null,
    diagnostics.host ? `host=${diagnostics.host}` : null,
    diagnostics.port ? `port=${diagnostics.port}` : null,
    diagnostics.database ? `database=${diagnostics.database}` : null
  ].filter(Boolean);

  return target.length ? target.join(", ") : "no database target detected";
}

function databaseMissingConfigMessage() {
  const diagnostics = getDatabaseConfigDiagnostics();
  const missing = diagnostics.missingMysqlEnv.length
    ? `缺少环境变量：${diagnostics.missingMysqlEnv.join(", ")}。`
    : "MYSQL_* 已提供但 DATABASE_URL 未生成。";

  return `DATABASE_URL 未配置，数据库无法连接。${missing} 当前目标：${formatDatabaseTarget()}。注意：app 服务也必须传 MYSQL_PASSWORD，不能只给 mysql 服务传。`;
}

type SetupCheck = {
  completed: boolean;
  databaseConfigured: boolean;
  databaseReachable: boolean;
  hasOwner: boolean;
  setupTokenDeleted: boolean;
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

type InstallationState = {
  reachable: boolean;
  installed: boolean;
  hasOwner: boolean;
  setupTokenDeleted: boolean;
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

function getRpId(siteUrl: string) {
  try {
    return new URL(siteUrl).hostname || "localhost";
  } catch {
    return "localhost";
  }
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

async function queryInstallationState(): Promise<InstallationState> {
  const installation = await db.systemInstallation.findUnique({
    where: { id: "main" }
  });

  const ownerCount = await db.user.count({ where: { role: UserRole.Administer } });

  return {
    reachable: true,
    installed: installation?.installed ?? false,
    hasOwner: ownerCount > 0,
    setupTokenDeleted: installation?.setupTokenDeleted ?? false,
    error: undefined
  };
}

async function queryInstallationStateWithDetailedLogging(): Promise<InstallationState> {
  const timeoutMs = Number(process.env.DATABASE_TIMEOUT_MS || 5000);

  try {
    const tableReadiness = await getDatabaseTableReadiness(setupRequiredTables);
    if (!tableReadiness.ready) {
      console.error("[setup] database schema tables missing", {
        ...getDatabaseLogDetails(),
        requiredTables: setupRequiredTables,
        existingTables: tableReadiness.existing,
        missingTables: tableReadiness.missing
      });
      return {
        reachable: false,
        installed: false,
        hasOwner: false,
        setupTokenDeleted: false,
        error: `数据库已连接，但迁移未完成，缺少数据表：${tableReadiness.missing.join(", ")}。请检查容器启动日志中的 Prisma migrate deploy 是否失败，或重新部署包含最新 migrations 的镜像。当前目标：${formatDatabaseTarget()}。`
      };
    }

    return await Promise.race([
      queryInstallationState(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Database health check timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } catch (error) {
    console.error("[setup] database health check failed", getDatabaseLogDetails(error));
    return {
      reachable: false,
      installed: false,
      hasOwner: false,
      setupTokenDeleted: false,
      error: `${describeDatabaseError(error)} 当前目标：${formatDatabaseTarget()}。`
    };
  }
}

async function getInstallationState() {
  if (!isDatabaseConfigured()) {
    const error = databaseMissingConfigMessage();
    console.error("[setup] database config missing", getDatabaseLogDetails());
    return { reachable: false, installed: false, hasOwner: false, setupTokenDeleted: false, error };
  }

  return queryInstallationStateWithDetailedLogging();
}

export async function getSetupStatus(): Promise<SetupCheck> {
  const [status, token, installationState] = await Promise.all([
    readJsonFile<SetupStatusFile>(setupStatusPath),
    getOrCreateSetupToken().then(() => true).catch(() => false),
    getInstallationState()
  ]);

  const databaseConfigured = isDatabaseConfigured();
  const completed = installationState.installed || installationState.hasOwner;

  return {
    completed,
    databaseConfigured,
    databaseReachable: installationState.reachable,
    hasOwner: installationState.hasOwner,
    setupTokenDeleted: installationState.setupTokenDeleted,
    canInstall: !completed || !installationState.reachable || status?.state === "migration-failed",
    tokenReady: token,
    runtimeConfig: {
      siteUrl: process.env.SITE_URL || undefined,
      databaseHost: process.env.MYSQL_HOST || undefined,
      databaseName: process.env.MYSQL_DATABASE || undefined
    },
    status: status ?? undefined,
    error: status?.error || installationState.error
  };
}

async function assertSetupAllowed() {
  const installationState = await getInstallationState();

  if (installationState.installed || installationState.hasOwner) {
    throw new Error("系统已经完成安装，不能再次修改启动配置。");
  }

  if (!installationState.reachable) {
    throw new Error(installationState.error || "数据库不可用，请检查数据库连接配置。");
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

  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      message: "数据库未配置。请通过 MYSQL_* 环境变量或 DATABASE_URL 提供数据库连接信息。"
    };
  }

  const siteUrl = normalizeSiteUrl(parsed.data.siteUrl);
  const passwordHash = await bcrypt.hash(parsed.data.ownerPassword, 12);

  try {
    await db.$transaction(async (tx) => {
      // Create Administer user
      await tx.user.create({
        data: {
          email: parsed.data.ownerEmail.toLowerCase(),
          username: parsed.data.ownerUsername,
          nickname: parsed.data.ownerNickname,
          passwordHash,
          role: UserRole.Administer,
          status: UserStatus.ACTIVE,
          emailVerified: true
        }
      });

      // Write site settings
      const siteSettings: [string, string, SettingType][] = [
        ["site.url", siteUrl, SettingType.TEXT],
        ["site.title", parsed.data.siteTitle, SettingType.TEXT],
        ["passkey.rpId", getRpId(siteUrl), SettingType.TEXT],
        ["passkey.origin", siteUrl, SettingType.TEXT],
        ["passkey.rpName", parsed.data.passkeyRpName, SettingType.TEXT]
      ];

      for (const [key, value, type] of siteSettings) {
        await tx.setting.upsert({
          where: { key },
          update: { value, type },
          create: { key, value, type, group: key.split(".")[0] }
        });
      }

      // Write all default settings (skip ones we already wrote)
      const writtenKeys = new Set(siteSettings.map(([k]) => k));
      for (const [key, defaultValue, group, type] of defaultSettings) {
        if (writtenKeys.has(key)) continue;
        await tx.setting.upsert({
          where: { key },
          update: {},
          create: { key, value: String(defaultValue), group, type }
        });
      }

      // Create identity tiers
      for (const identity of publicIdentityTiers) {
        await tx.identity.upsert({
          where: { key: identity.key },
          update: {
            name: identity.name,
            description: identity.description,
            builtInRole: identity.builtInRole,
            permissions: defaultRolePermissions[identity.builtInRole] || []
          },
          create: {
            key: identity.key,
            name: identity.name,
            description: identity.description,
            builtInRole: identity.builtInRole,
            permissions: defaultRolePermissions[identity.builtInRole] || []
          }
        });
      }

      // Set default identity for registration
      const userIdentity = await tx.identity.findUnique({ where: { key: "user" }, select: { id: true } });
      if (userIdentity) {
        await tx.setting.upsert({
          where: { key: "register.defaultIdentityId" },
          update: { value: userIdentity.id, group: "identity", type: SettingType.TEXT },
          create: { key: "register.defaultIdentityId", value: userIdentity.id, group: "identity", type: SettingType.TEXT }
        });
      }

      // Mark installation as complete in database
      await tx.systemInstallation.upsert({
        where: { id: "main" },
        update: {
          installed: true,
          installedAt: new Date()
        },
        create: {
          id: "main",
          installed: true,
          installedAt: new Date()
        }
      });
    });
  } catch (error) {
    console.error("[setup] Failed to initialize system", error);
    await writeSetupStatus({
      state: "migration-failed",
      updatedAt: new Date().toISOString(),
      siteUrl,
      databaseHost: process.env.MYSQL_HOST || undefined,
      databaseName: process.env.MYSQL_DATABASE || undefined,
      error: error instanceof Error ? error.message : "System initialization failed."
    });
    return {
      ok: false,
      message: "系统初始化失败，请检查日志。"
    };
  }

  // Write install.lock (backward compatibility)
  await ensureConfigDir();
  await writeFile(installLockPath, new Date().toISOString(), { mode: 0o600 });

  // Delete setup token and mark in database
  try {
    await unlink(setupTokenPath);
  } catch {
    // Token file may not exist if token was provided via env var
  }

  // Mark token as deleted in database
  try {
    await db.systemInstallation.upsert({
      where: { id: "main" },
      update: { setupTokenDeleted: true },
      create: { id: "main", installed: true, installedAt: new Date(), setupTokenDeleted: true }
    });
  } catch {
    // Non-critical, token file deletion already attempted
  }

  // Clear setup mode so middleware stops redirecting
  process.env.SETUP_REQUIRED = "false";
  delete process.env.SETUP_TOKEN;

  // Write status
  await writeSetupStatus({
    state: "complete",
    updatedAt: new Date().toISOString(),
    siteUrl
  });

  return {
    ok: true,
    message: "系统安装完成！请刷新页面进入站点。",
    restart: false,
    redirectTo: "/login?callbackUrl=/admin"
  };
}
