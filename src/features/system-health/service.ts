import "server-only";

import { readdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  ArticleTranslationJobStatus,
  BackupStatus,
  LoginEventMethod,
  MailSendStatus,
  PublicContentTranslationJobStatus,
  UserRole,
  UserStatus
} from "@prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { shouldRunInProcessWorkers } from "@/lib/background-worker";
import {
  db,
  describeDatabaseError,
  getDatabaseConfigDiagnostics,
  isDatabaseConfigured
} from "@/lib/db";
import { assertPermission, canManageSettings } from "@/lib/permissions";
import { getBackupRoot, getStorageRoot, getUploadRoot } from "@/lib/runtime-paths";
import {
  backupScheduleSettingKeys,
  defaultBackupScheduleTime,
  normalizeScheduleTime,
  type BackupScheduleFrequency
} from "@/features/backup/service";

export type SystemHealthStatus = "ok" | "warning" | "critical";

export type RuntimeDirectoryHealth = {
  key: "storage" | "uploads" | "backups";
  path: string;
  exists: boolean;
  writable: boolean;
  entries: number | null;
  status: SystemHealthStatus;
  error?: string;
};

export type QueueHealth = {
  status: SystemHealthStatus;
  article: Record<ArticleTranslationJobStatus, number> & { staleRunning: number };
  publicContent: Record<PublicContentTranslationJobStatus, number> & { staleRunning: number };
  error?: string;
};

export type SystemHealthReport = {
  generatedAt: Date;
  overallStatus: SystemHealthStatus;
  runtime: {
    nodeEnv: string;
    nodeVersion: string;
    timezone: string;
    workerMode: string;
    workerRole: string;
    inProcessWorkersEnabled: boolean;
  };
  database: {
    status: SystemHealthStatus;
    configured: boolean;
    source: string;
    host?: string;
    port?: string;
    database?: string;
    user?: string;
    missingMysqlEnv: string[];
    latencyMs: number | null;
    error?: string;
  };
  directories: RuntimeDirectoryHealth[];
  backup: {
    status: SystemHealthStatus;
    scheduleEnabled: boolean;
    frequency: BackupScheduleFrequency;
    time: string;
    retentionDays: number;
    lastRunAt: Date | null;
    lastRunStatus: string;
    latestBackup: {
      filename: string;
      sizeBytes: number;
      status: BackupStatus;
      createdAt: Date;
      error: string | null;
    } | null;
    failedLast7Days: number;
    error?: string;
  };
  queues: QueueHealth;
  mail: {
    status: SystemHealthStatus;
    notificationsEnabled: boolean;
    ready: boolean;
    source: "environment" | "settings" | "none";
    hostConfigured: boolean;
    fromConfigured: boolean;
    userConfigured: boolean;
    passwordConfigured: boolean;
    failedLast24Hours: number;
    skippedLast24Hours: number;
    error?: string;
  };
  security: {
    status: SystemHealthStatus;
    activeAdminUsers: number;
    disabledAdminUsers: number;
    activeSessions: number;
    trustedDevices: number;
    smtpFailOpenLast24Hours: number;
    recentLoginEvents: number;
    error?: string;
  };
};

const queueStaleAfterMs = 15 * 60 * 1000;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function worstStatus(statuses: SystemHealthStatus[]): SystemHealthStatus {
  if (statuses.includes("critical")) {
    return "critical";
  }
  if (statuses.includes("warning")) {
    return "warning";
  }
  return "ok";
}

function emptyArticleQueueCounts() {
  return {
    [ArticleTranslationJobStatus.QUEUED]: 0,
    [ArticleTranslationJobStatus.RUNNING]: 0,
    [ArticleTranslationJobStatus.SUCCEEDED]: 0,
    [ArticleTranslationJobStatus.FAILED]: 0,
    [ArticleTranslationJobStatus.CANCELED]: 0,
    staleRunning: 0
  };
}

function emptyPublicQueueCounts() {
  return {
    [PublicContentTranslationJobStatus.QUEUED]: 0,
    [PublicContentTranslationJobStatus.RUNNING]: 0,
    [PublicContentTranslationJobStatus.SUCCEEDED]: 0,
    [PublicContentTranslationJobStatus.FAILED]: 0,
    [PublicContentTranslationJobStatus.CANCELED]: 0,
    staleRunning: 0
  };
}

async function checkDatabase() {
  const diagnostics = getDatabaseConfigDiagnostics();
  if (!isDatabaseConfigured()) {
    return {
      status: "critical" as const,
      configured: false,
      source: diagnostics.source,
      host: diagnostics.host,
      port: diagnostics.port,
      database: diagnostics.database,
      user: diagnostics.user,
      missingMysqlEnv: diagnostics.missingMysqlEnv,
      latencyMs: null,
      error: "DATABASE_URL is not configured."
    };
  }

  if (diagnostics.databaseUrlInvalid) {
    return {
      status: "critical" as const,
      configured: true,
      source: diagnostics.source,
      host: diagnostics.host,
      port: diagnostics.port,
      database: diagnostics.database,
      user: diagnostics.user,
      missingMysqlEnv: diagnostics.missingMysqlEnv,
      latencyMs: null,
      error: "DATABASE_URL is invalid."
    };
  }

  const startedAt = Date.now();
  let timer: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      db.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Database health query timed out after 1500ms.")), 1500);
      })
    ]);

    return {
      status: "ok" as const,
      configured: true,
      source: diagnostics.source,
      host: diagnostics.host,
      port: diagnostics.port,
      database: diagnostics.database,
      user: diagnostics.user,
      missingMysqlEnv: diagnostics.missingMysqlEnv,
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      status: "critical" as const,
      configured: true,
      source: diagnostics.source,
      host: diagnostics.host,
      port: diagnostics.port,
      database: diagnostics.database,
      user: diagnostics.user,
      missingMysqlEnv: diagnostics.missingMysqlEnv,
      latencyMs: null,
      error: describeDatabaseError(error)
    };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function checkDirectory(key: RuntimeDirectoryHealth["key"], directory: string): Promise<RuntimeDirectoryHealth> {
  const resolved = path.resolve(directory);

  try {
    const info = await stat(resolved);
    if (!info.isDirectory()) {
      return {
        key,
        path: resolved,
        exists: true,
        writable: false,
        entries: null,
        status: "critical",
        error: "Path exists but is not a directory."
      };
    }

    const probe = path.join(resolved, `.health-check-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    let writable = true;
    let writeError: string | undefined;
    try {
      await writeFile(probe, "ok", { flag: "wx" });
      await unlink(probe).catch(() => undefined);
    } catch (error) {
      writable = false;
      writeError = errorMessage(error);
    }

    let entries: number | null = null;
    try {
      entries = (await readdir(resolved)).length;
    } catch {
      entries = null;
    }

    return {
      key,
      path: resolved,
      exists: true,
      writable,
      entries,
      status: writable ? "ok" : "critical",
      error: writeError
    };
  } catch (error) {
    return {
      key,
      path: resolved,
      exists: false,
      writable: false,
      entries: null,
      status: "critical",
      error: errorMessage(error)
    };
  }
}

async function readSettings(keys: string[]) {
  const rows = await db.setting.findMany({
    where: { key: { in: keys } },
    select: { key: true, value: true }
  });

  return Object.fromEntries(rows.map((row) => [row.key, row.value])) as Record<string, string>;
}

function normalizeFrequency(value: unknown): BackupScheduleFrequency {
  return value === "weekly" || value === "monthly" ? value : "daily";
}

async function collectBackupHealth(databaseOk: boolean): Promise<SystemHealthReport["backup"]> {
  if (!databaseOk) {
    return {
      status: "critical",
      scheduleEnabled: false,
      frequency: "daily",
      time: defaultBackupScheduleTime,
      retentionDays: 7,
      lastRunAt: null,
      lastRunStatus: "",
      latestBackup: null,
      failedLast7Days: 0,
      error: "Database is not available."
    };
  }

  try {
    const settings = await readSettings(Object.values(backupScheduleSettingKeys));
    const [latestBackup, failedLast7Days] = await Promise.all([
      db.backupRecord.findFirst({
        orderBy: { createdAt: "desc" },
        select: {
          filename: true,
          sizeBytes: true,
          status: true,
          createdAt: true,
          error: true
        }
      }),
      db.backupRecord.count({
        where: {
          status: BackupStatus.FAILED,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      })
    ]);
    const scheduleEnabled = settings[backupScheduleSettingKeys.enabled] !== "false";
    const lastRunAt = settings[backupScheduleSettingKeys.lastRunAt]
      ? new Date(settings[backupScheduleSettingKeys.lastRunAt])
      : null;
    const lastRunStatus = settings[backupScheduleSettingKeys.lastRunStatus] ?? "";
    const backupStatus = worstStatus([
      !scheduleEnabled ? "warning" : "ok",
      !latestBackup ? "warning" : "ok",
      latestBackup?.status === BackupStatus.FAILED || failedLast7Days > 0 ? "warning" : "ok",
      lastRunStatus.startsWith("failed") ? "warning" : "ok"
    ]);

    return {
      status: backupStatus,
      scheduleEnabled,
      frequency: normalizeFrequency(settings[backupScheduleSettingKeys.frequency]),
      time: normalizeScheduleTime(settings[backupScheduleSettingKeys.time] ?? defaultBackupScheduleTime),
      retentionDays: Number(settings[backupScheduleSettingKeys.retentionDays] ?? 7),
      lastRunAt,
      lastRunStatus,
      latestBackup,
      failedLast7Days
    };
  } catch (error) {
    return {
      status: "warning",
      scheduleEnabled: false,
      frequency: "daily",
      time: defaultBackupScheduleTime,
      retentionDays: 7,
      lastRunAt: null,
      lastRunStatus: "",
      latestBackup: null,
      failedLast7Days: 0,
      error: errorMessage(error)
    };
  }
}

function countRows<T extends string>(
  statuses: readonly T[],
  rows: Array<{ status: T; _count: { _all: number } }>
) {
  const counts = Object.fromEntries(statuses.map((status) => [status, 0])) as Record<T, number>;
  for (const row of rows) {
    counts[row.status] = row._count._all;
  }
  return counts;
}

async function collectQueueHealth(databaseOk: boolean): Promise<QueueHealth> {
  const article = emptyArticleQueueCounts();
  const publicContent = emptyPublicQueueCounts();
  if (!databaseOk) {
    return { status: "critical", article, publicContent, error: "Database is not available." };
  }

  try {
    const staleBefore = new Date(Date.now() - queueStaleAfterMs);
    const [
      articleRows,
      publicRows,
      staleArticleRunning,
      stalePublicRunning
    ] = await Promise.all([
      db.articleTranslationJob.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      db.publicContentTranslationJob.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      db.articleTranslationJob.count({
        where: {
          status: ArticleTranslationJobStatus.RUNNING,
          updatedAt: { lt: staleBefore }
        }
      }),
      db.publicContentTranslationJob.count({
        where: {
          status: PublicContentTranslationJobStatus.RUNNING,
          updatedAt: { lt: staleBefore }
        }
      })
    ]);

    const articleCounts = {
      ...countRows(Object.values(ArticleTranslationJobStatus), articleRows),
      staleRunning: staleArticleRunning
    };
    const publicContentCounts = {
      ...countRows(Object.values(PublicContentTranslationJobStatus), publicRows),
      staleRunning: stalePublicRunning
    };

    const status = worstStatus([
      articleCounts.FAILED > 0 || publicContentCounts.FAILED > 0 ? "warning" : "ok",
      articleCounts.staleRunning > 0 || publicContentCounts.staleRunning > 0 ? "warning" : "ok"
    ]);

    return { status, article: articleCounts, publicContent: publicContentCounts };
  } catch (error) {
    return {
      status: "warning",
      article,
      publicContent,
      error: errorMessage(error)
    };
  }
}

function completeSmtpConfig(values: Record<string, string | undefined>) {
  const host = values["smtp.host"]?.trim();
  const user = values["smtp.user"]?.trim();
  const pass = values["smtp.pass"]?.trim();
  const from = values["smtp.from"]?.trim() || user;

  return {
    ready: Boolean(host && user && pass && from),
    hostConfigured: Boolean(host),
    userConfigured: Boolean(user),
    passwordConfigured: Boolean(pass),
    fromConfigured: Boolean(from)
  };
}

async function collectMailHealth(databaseOk: boolean): Promise<SystemHealthReport["mail"]> {
  const envConfig = completeSmtpConfig({
    "smtp.host": process.env.SMTP_HOST,
    "smtp.user": process.env.SMTP_USER,
    "smtp.pass": process.env.SMTP_PASS,
    "smtp.from": process.env.SMTP_FROM
  });

  if (!databaseOk) {
    return {
      status: envConfig.ready ? "warning" : "critical",
      notificationsEnabled: true,
      ready: envConfig.ready,
      source: envConfig.ready ? "environment" : "none",
      hostConfigured: envConfig.hostConfigured,
      fromConfigured: envConfig.fromConfigured,
      userConfigured: envConfig.userConfigured,
      passwordConfigured: envConfig.passwordConfigured,
      failedLast24Hours: 0,
      skippedLast24Hours: 0,
      error: "Database is not available."
    };
  }

  try {
    const settings = await readSettings([
      "smtp.host",
      "smtp.user",
      "smtp.pass",
      "smtp.from",
      "smtp.notificationsEnabled"
    ]);
    const settingsConfig = completeSmtpConfig(settings);
    const activeConfig = envConfig.ready ? envConfig : settingsConfig;
    const source = envConfig.ready ? "environment" : settingsConfig.ready ? "settings" : "none";
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const mailRows = await db.mailSendLog.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since } },
      _count: { _all: true }
    });
    const mailCounts = countRows(Object.values(MailSendStatus), mailRows);
    const notificationsEnabled = settings["smtp.notificationsEnabled"] !== "false";
    const status = worstStatus([
      notificationsEnabled && !activeConfig.ready ? "warning" : "ok",
      mailCounts.FAILED > 0 ? "warning" : "ok"
    ]);

    return {
      status,
      notificationsEnabled,
      ready: activeConfig.ready,
      source,
      hostConfigured: activeConfig.hostConfigured,
      fromConfigured: activeConfig.fromConfigured,
      userConfigured: activeConfig.userConfigured,
      passwordConfigured: activeConfig.passwordConfigured,
      failedLast24Hours: mailCounts.FAILED,
      skippedLast24Hours: mailCounts.SKIPPED
    };
  } catch (error) {
    return {
      status: "warning",
      notificationsEnabled: true,
      ready: envConfig.ready,
      source: envConfig.ready ? "environment" : "none",
      hostConfigured: envConfig.hostConfigured,
      fromConfigured: envConfig.fromConfigured,
      userConfigured: envConfig.userConfigured,
      passwordConfigured: envConfig.passwordConfigured,
      failedLast24Hours: 0,
      skippedLast24Hours: 0,
      error: errorMessage(error)
    };
  }
}

async function collectSecurityHealth(databaseOk: boolean): Promise<SystemHealthReport["security"]> {
  if (!databaseOk) {
    return {
      status: "critical",
      activeAdminUsers: 0,
      disabledAdminUsers: 0,
      activeSessions: 0,
      trustedDevices: 0,
      smtpFailOpenLast24Hours: 0,
      recentLoginEvents: 0,
      error: "Database is not available."
    };
  }

  try {
    const now = new Date();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      activeAdminUsers,
      disabledAdminUsers,
      activeSessions,
      trustedDevices,
      smtpFailOpenLast24Hours,
      recentLoginEvents
    ] = await Promise.all([
      db.user.count({ where: { role: UserRole.Administer, status: UserStatus.ACTIVE } }),
      db.user.count({ where: { role: UserRole.Administer, status: UserStatus.DISABLED } }),
      db.authSession.count({ where: { expiresAt: { gt: now } } }),
      db.trustedDevice.count(),
      db.loginEvent.count({
        where: {
          method: LoginEventMethod.SMTP_FAIL_OPEN,
          createdAt: { gte: since }
        }
      }),
      db.loginEvent.count({ where: { createdAt: { gte: since } } })
    ]);

    return {
      status: worstStatus([
        activeAdminUsers === 0 ? "critical" : "ok",
        smtpFailOpenLast24Hours > 0 ? "warning" : "ok"
      ]),
      activeAdminUsers,
      disabledAdminUsers,
      activeSessions,
      trustedDevices,
      smtpFailOpenLast24Hours,
      recentLoginEvents
    };
  } catch (error) {
    return {
      status: "warning",
      activeAdminUsers: 0,
      disabledAdminUsers: 0,
      activeSessions: 0,
      trustedDevices: 0,
      smtpFailOpenLast24Hours: 0,
      recentLoginEvents: 0,
      error: errorMessage(error)
    };
  }
}

export async function getSystemHealthReport(user: CurrentUser): Promise<SystemHealthReport> {
  assertPermission(canManageSettings(user), "You do not have permission to view system health.");

  const database = await checkDatabase();
  const databaseOk = database.status === "ok";
  const runtime = {
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    nodeVersion: process.versions.node,
    timezone: process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone || "server-default",
    workerMode: process.env.BACKGROUND_WORKER_MODE ?? "in-process",
    workerRole: process.env.BACKGROUND_WORKER_ROLE ?? "web",
    inProcessWorkersEnabled: shouldRunInProcessWorkers()
  };
  const [directories, backup, queues, mail, security] = await Promise.all([
    Promise.all([
      checkDirectory("storage", getStorageRoot()),
      checkDirectory("uploads", getUploadRoot()),
      checkDirectory("backups", getBackupRoot())
    ]),
    collectBackupHealth(databaseOk),
    collectQueueHealth(databaseOk),
    collectMailHealth(databaseOk),
    collectSecurityHealth(databaseOk)
  ]);
  const activeQueueCount =
    queues.article.QUEUED +
    queues.article.RUNNING +
    queues.publicContent.QUEUED +
    queues.publicContent.RUNNING;
  const workerQueueStatus =
    runtime.workerMode === "external" && runtime.workerRole !== "worker" && activeQueueCount > 0
      ? "warning"
      : "ok";

  return {
    generatedAt: new Date(),
    overallStatus: worstStatus([
      database.status,
      ...directories.map((directory) => directory.status),
      backup.status,
      queues.status,
      mail.status,
      security.status,
      workerQueueStatus
    ]),
    runtime,
    database,
    directories,
    backup,
    queues,
    mail,
    security
  };
}
