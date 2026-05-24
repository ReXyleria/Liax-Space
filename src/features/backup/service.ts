import { mkdir, readFile, readdir, rm, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { BackupStatus, SettingType } from "@prisma/client";
import { db, isDatabaseConfigured } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { assertPermission, canManageBackups } from "@/lib/permissions";
import { getBackupRoot, getUploadRoot } from "@/lib/runtime-paths";
import { createTarGzArchive, parseTarGzArchive, type BackupArchiveEntry } from "@/features/backup/archive";

const backupRoot = getBackupRoot();
const uploadRoot = getUploadRoot();
const backupVersion = 2;
const legacyJsonBackupVersion = 1;
export const backupScheduleSettingKeys = {
  enabled: "backup.schedule.enabled",
  frequency: "backup.schedule.frequency",
  retentionDays: "backup.schedule.retentionDays",
  time: "backup.schedule.time",
  lastRunDate: "backup.schedule.lastRunDate",
  lastRunAt: "backup.schedule.lastRunAt",
  lastRunStatus: "backup.schedule.lastRunStatus"
} as const;

export const defaultBackupScheduleTime = "08:00";
export const scheduleGroup = "Data and Backup";

export type BackupScheduleFrequency = "daily" | "weekly" | "monthly";
export type BackupRetentionDays = 1 | 3 | 5 | 7 | 30;

export type BackupScheduleConfig = {
  enabled: boolean;
  frequency: BackupScheduleFrequency;
  retentionDays: BackupRetentionDays;
  time: string;
};

const retentionOptions = [1, 3, 5, 7, 30] as const;

export function normalizeRetentionDays(value: unknown): BackupRetentionDays {
  const parsed = Number(value);
  return retentionOptions.includes(parsed as BackupRetentionDays) ? parsed as BackupRetentionDays : 7;
}

export function normalizeScheduleTime(value: unknown) {
  const raw = String(value ?? "").trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : defaultBackupScheduleTime;
}

async function ensureBackupRoot() {
  await mkdir(backupRoot, { recursive: true });
}

async function ensureUploadRootForRestore() {
  try {
    await mkdir(uploadRoot, { recursive: true });
    const uploadStat = await stat(uploadRoot);
    if (!uploadStat.isDirectory()) {
      throw new Error(`${uploadRoot} exists but is not a directory.`);
    }

    const probePath = path.join(uploadRoot, `.restore-write-test-${process.pid}-${Date.now()}`);
    await writeFile(probePath, "");
    await unlink(probePath).catch(() => undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown upload directory error.";
    throw new Error(`Unable to prepare upload directory for restore: ${uploadRoot}. ${message}`);
  }
}

function safeFilenameSegment(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug || "liax-space";
}

function padTimestampPart(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

function localBackupTimestamp(date = new Date()) {
  return [
    date.getFullYear(),
    padTimestampPart(date.getMonth() + 1),
    padTimestampPart(date.getDate())
  ].join("-")
    + "T"
    + [
      padTimestampPart(date.getHours()),
      padTimestampPart(date.getMinutes()),
      padTimestampPart(date.getSeconds()),
      padTimestampPart(date.getMilliseconds(), 3)
    ].join("-");
}

async function getBackupSiteTitle() {
  try {
    const setting = await db.setting.findUnique({
      where: { key: "site.title" },
      select: { value: true }
    });
    return setting?.value?.trim() || "Liax-Space";
  } catch {
    return "Liax-Space";
  }
}

async function backupFilename() {
  const stamp = localBackupTimestamp();
  return `${safeFilenameSegment(await getBackupSiteTitle())}-${stamp}.tar.gz`;
}

function uploadedBackupFilename(originalName: string) {
  const stamp = localBackupTimestamp();
  const fallback = "backup.tar.gz";
  const basename = path.basename(originalName || fallback);
  const safeName = basename
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || fallback;

  return `uploaded-${stamp}-${safeName}`;
}

function safeBackupPath(filePath: string) {
  const root = path.resolve(backupRoot);
  const resolved = path.resolve(filePath);
  const relative = path.relative(root, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Backup path is outside the configured backup directory.");
  }

  return resolved;
}

async function collectUploads(dir = uploadRoot, base = "uploads"): Promise<BackupArchiveEntry[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(entries.map(async (entry) => {
      const absolute = path.join(dir, entry.name);
      const archivePath = `${base}/${entry.name}`;
      if (entry.isDirectory()) {
        return collectUploads(absolute, archivePath);
      }
      if (!entry.isFile() || entry.name === ".gitkeep") {
        return [];
      }
      return [{
        path: archivePath,
        data: await readFile(absolute),
        mtime: (await stat(absolute)).mtime
      }];
    }));
    return files.flat();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function copyDirectory(source: string, target: string) {
  await mkdir(target, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });

  await Promise.all(entries.map(async (entry) => {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
      return;
    }
    if (entry.isFile()) {
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, await readFile(sourcePath));
    }
  }));
}

async function clearDirectoryContents(target: string) {
  await mkdir(target, { recursive: true });
  const entries = await readdir(target, { withFileTypes: true });

  await Promise.all(entries.map(async (entry) => {
    if (entry.name === ".gitkeep") {
      return;
    }
    await rm(path.join(target, entry.name), { recursive: true, force: true });
  }));
}

async function exportData() {
  const [
    identities,
    users,
    authSessions,
    loginEvents,
    pendingAuths,
    trustedDevices,
    verificationCodes,
    passkeyCredentials,
    totpRecoveryCodes,
    webauthnChallenges,
    settings,
    mailTemplates,
    mailSendLogs,
    tags,
    articles,
    articleAllowedIdentities,
    articleTags,
    articleVersions,
    articleContents,
    articleTranslations,
    articleTranslationJobs,
    publicContentTranslations,
    publicContentTranslationJobs,
    comments,
    moments,
    momentLikes,
    momentComments,
    guestbookMessages,
    guestbookComments,
    guestbookLikes,
    visitLogs,
    mediaAssets,
    mediaReferences
  ] = await Promise.all([
    db.identity.findMany(),
    db.user.findMany(),
    db.authSession.findMany(),
    db.loginEvent.findMany(),
    db.pendingAuth.findMany(),
    db.trustedDevice.findMany(),
    db.verificationCode.findMany(),
    db.passkeyCredential.findMany(),
    db.totpRecoveryCode.findMany(),
    db.webAuthnChallenge.findMany(),
    db.setting.findMany(),
    db.mailTemplate.findMany(),
    db.mailSendLog.findMany(),
    db.tag.findMany(),
    db.article.findMany(),
    db.articleAllowedIdentity.findMany(),
    db.articleTag.findMany(),
    db.articleVersion.findMany(),
    db.articleContent.findMany(),
    db.articleTranslation.findMany(),
    db.articleTranslationJob.findMany(),
    db.publicContentTranslation.findMany(),
    db.publicContentTranslationJob.findMany(),
    db.comment.findMany(),
    db.moment.findMany(),
    db.momentLike.findMany(),
    db.momentComment.findMany(),
    db.guestbookMessage.findMany(),
    db.guestbookComment.findMany(),
    db.guestbookLike.findMany(),
    db.visitLog.findMany(),
    db.mediaAsset.findMany(),
    db.mediaReference.findMany()
  ]);

  return {
    version: backupVersion,
    exportedAt: new Date().toISOString(),
    data: {
      identities,
      users,
      authSessions,
      loginEvents,
      pendingAuths,
      trustedDevices,
      verificationCodes,
      passkeyCredentials,
      totpRecoveryCodes,
      webauthnChallenges,
      settings,
      mailTemplates,
      mailSendLogs,
      tags,
      articles,
      articleAllowedIdentities,
      articleTags,
      articleVersions,
      articleContents,
      articleTranslations,
      articleTranslationJobs,
      publicContentTranslations,
      publicContentTranslationJobs,
      comments,
      moments,
      momentLikes,
      momentComments,
      guestbookMessages,
      guestbookComments,
      guestbookLikes,
      visitLogs,
      mediaAssets,
      mediaReferences
    }
  };
}

type BackupPayload = Awaited<ReturnType<typeof exportData>>;
type BackupData = BackupPayload["data"];

function asRows<T = unknown>(data: BackupData, key: keyof BackupData): T[] {
  const rows = data[key];
  return Array.isArray(rows) ? rows as T[] : [];
}

async function insertRows(delegate: unknown, rows: unknown[]) {
  if (rows.length) {
    await (delegate as { createMany: (args: { data: never[] }) => Promise<unknown> }).createMany({ data: rows as never[] });
  }
}

function parseBackupPayload(bytes: Buffer): {
  payload: BackupPayload;
  uploadEntries: BackupArchiveEntry[];
  hasUploadSnapshot: boolean;
} {
  const preview = bytes.subarray(0, Math.min(bytes.length, 64)).toString("utf8").trimStart();
  if (preview.startsWith("{")) {
    const payload = JSON.parse(bytes.toString("utf8")) as BackupPayload;
    return { payload, uploadEntries: [], hasUploadSnapshot: false };
  }

  const entries = parseTarGzArchive(bytes);
  const databaseEntry = entries.find((entry) => entry.path === "database.json");
  if (!databaseEntry) {
    throw new Error("Backup archive does not contain database.json.");
  }

  return {
    payload: JSON.parse(databaseEntry.data.toString("utf8")) as BackupPayload,
    uploadEntries: entries.filter((entry) => entry.path.startsWith("uploads/")),
    hasUploadSnapshot: true
  };
}

type StagedUploadRestore = {
  restoreRoot: string;
  stagedUploads: string;
};

async function stageUploadEntries(uploadEntries: BackupArchiveEntry[], hasUploadSnapshot: boolean): Promise<StagedUploadRestore | null> {
  if (!hasUploadSnapshot) {
    return null;
  }

  await ensureUploadRootForRestore();
  await ensureBackupRoot();

  const restoreRoot = path.join(backupRoot, `.restore-${Date.now()}`);
  const stagedUploads = path.join(restoreRoot, "uploads");

  await rm(restoreRoot, { recursive: true, force: true });
  await mkdir(stagedUploads, { recursive: true });

  try {
    for (const entry of uploadEntries) {
      const relative = entry.path.replace(/^uploads\/?/, "");
      if (!relative) {
        continue;
      }
      const target = path.resolve(stagedUploads, relative);
      const stagedRelative = path.relative(stagedUploads, target);
      if (stagedRelative.startsWith("..") || path.isAbsolute(stagedRelative)) {
        throw new Error("Backup archive contains an unsafe upload path.");
      }
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, entry.data);
    }

    return { restoreRoot, stagedUploads };
  } catch (error) {
    await rm(restoreRoot, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function writeStagedUploadEntries(stagedRestore: StagedUploadRestore | null) {
  if (!stagedRestore) {
    return;
  }

  try {
    await ensureUploadRootForRestore();
    await clearDirectoryContents(uploadRoot);
    await copyDirectory(stagedRestore.stagedUploads, uploadRoot);
  } finally {
    await rm(stagedRestore.restoreRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

function isSupportedBackupFilename(filename: string) {
  const lower = filename.toLowerCase();
  return lower.endsWith(".tar.gz") || lower.endsWith(".tgz") || lower.endsWith(".json");
}

export async function listBackups(user: CurrentUser) {
  assertPermission(canManageBackups(user), "You do not have permission to manage backups.");

  if (!isDatabaseConfigured()) {
    return { backups: [], error: "DATABASE_URL is not configured." };
  }

  try {
    return {
      backups: await db.backupRecord.findMany({ orderBy: { createdAt: "desc" } }),
      error: null as string | null
    };
  } catch (error) {
    console.error("Failed to list backups", error);
    return { backups: [], error: "Failed to load backups." };
  }
}

export async function syncBackupDirectory(user: CurrentUser) {
  assertPermission(canManageBackups(user), "You do not have permission to scan backups.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await ensureBackupRoot();
  const existing = await db.backupRecord.findMany({ select: { filePath: true } });
  const knownPaths = new Set(existing.map((record) => path.resolve(record.filePath)));
  const entries = await readdir(backupRoot, { withFileTypes: true });
  let imported = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !isSupportedBackupFilename(entry.name)) {
      continue;
    }

    const filePath = safeBackupPath(path.join(backupRoot, entry.name));
    if (knownPaths.has(path.resolve(filePath))) {
      continue;
    }

    try {
      const bytes = await readFile(filePath);
      const { payload } = parseBackupPayload(bytes);
      if (![backupVersion, legacyJsonBackupVersion].includes(payload.version) || !payload.data) {
        skipped += 1;
        continue;
      }

      const fileStat = await stat(filePath);
      await db.backupRecord.create({
        data: {
          filename: entry.name,
          filePath,
          sizeBytes: fileStat.size,
          reason: "folder-scan",
          createdById: user.id
        }
      });
      knownPaths.add(path.resolve(filePath));
      imported += 1;
    } catch (error) {
      console.warn("Skipped unsupported backup file during backup directory sync", {
        file: entry.name,
        error: error instanceof Error ? error.message : String(error)
      });
      skipped += 1;
    }
  }

  return { imported, skipped };
}

export async function getBackupScheduleConfig(user: CurrentUser) {
  assertPermission(canManageBackups(user), "You do not have permission to manage backup schedules.");

  if (!isDatabaseConfigured()) {
    return {
      config: {
        enabled: true,
        frequency: "daily" as BackupScheduleFrequency,
        retentionDays: 7 as BackupRetentionDays,
        time: defaultBackupScheduleTime
      },
      error: "DATABASE_URL is not configured."
    };
  }

  try {
    const settings = await db.setting.findMany({
      where: {
        key: {
          in: [
            backupScheduleSettingKeys.enabled,
            backupScheduleSettingKeys.frequency,
            backupScheduleSettingKeys.retentionDays,
            backupScheduleSettingKeys.time
          ]
        }
      }
    });
    const map = new Map(settings.map((setting) => [setting.key, setting.value]));
    const rawFrequency = map.get(backupScheduleSettingKeys.frequency);
    const frequency: BackupScheduleFrequency =
      rawFrequency === "weekly" || rawFrequency === "monthly" ? rawFrequency : "daily";

    return {
      config: {
        enabled: map.get(backupScheduleSettingKeys.enabled) !== "false",
        frequency,
        retentionDays: normalizeRetentionDays(map.get(backupScheduleSettingKeys.retentionDays)),
        time: normalizeScheduleTime(map.get(backupScheduleSettingKeys.time))
      },
      error: null as string | null
    };
  } catch (error) {
    console.error("Failed to read backup schedule config", error);
    return {
      config: {
        enabled: true,
        frequency: "daily" as BackupScheduleFrequency,
        retentionDays: 7 as BackupRetentionDays,
        time: defaultBackupScheduleTime
      },
      error: "Failed to load backup schedule config."
    };
  }
}

export async function updateBackupScheduleConfig(user: CurrentUser, input: unknown) {
  assertPermission(canManageBackups(user), "You do not have permission to manage backup schedules.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const data = input instanceof FormData
    ? {
        enabled: input.get("enabled") === "true",
        frequency: String(input.get("frequency") ?? "daily"),
        retentionDays: input.get("retentionDays")
      }
    : input as Partial<{ enabled: boolean; frequency: string; retentionDays: unknown }>;
  const frequency: BackupScheduleFrequency =
    data.frequency === "weekly" || data.frequency === "monthly" ? data.frequency : "daily";
  const retentionDays = normalizeRetentionDays(data.retentionDays);

  await db.$transaction([
    db.setting.upsert({
      where: { key: backupScheduleSettingKeys.enabled },
      update: { value: data.enabled ? "true" : "false" },
      create: {
        key: backupScheduleSettingKeys.enabled,
        value: data.enabled ? "true" : "false",
        group: scheduleGroup,
        type: SettingType.BOOLEAN
      }
    }),
    db.setting.upsert({
      where: { key: backupScheduleSettingKeys.frequency },
      update: { value: frequency },
      create: {
        key: backupScheduleSettingKeys.frequency,
        value: frequency,
        group: scheduleGroup,
        type: SettingType.TEXT
      }
    }),
    db.setting.upsert({
      where: { key: backupScheduleSettingKeys.retentionDays },
      update: { value: String(retentionDays) },
      create: {
        key: backupScheduleSettingKeys.retentionDays,
        value: String(retentionDays),
        group: scheduleGroup,
        type: SettingType.NUMBER
      }
    }),
    db.setting.upsert({
      where: { key: backupScheduleSettingKeys.time },
      update: { value: defaultBackupScheduleTime },
      create: {
        key: backupScheduleSettingKeys.time,
        value: defaultBackupScheduleTime,
        group: scheduleGroup,
        type: SettingType.TEXT
      }
    })
  ]);

  return { enabled: Boolean(data.enabled), frequency, retentionDays, time: defaultBackupScheduleTime };
}

async function pruneScheduledBackups(retentionDays: BackupRetentionDays) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const expired = await db.backupRecord.findMany({
    where: {
      reason: "scheduled-cli",
      createdAt: { lt: cutoff }
    },
    select: { id: true, filePath: true }
  });

  for (const backup of expired) {
    await db.backupRecord.delete({ where: { id: backup.id } }).catch(() => undefined);
    try {
      await unlink(safeBackupPath(backup.filePath)).catch(() => undefined);
    } catch {
      // Ignore unsafe legacy paths during retention cleanup; the record is already removed.
    }
  }
}

export async function createBackup(user: CurrentUser, reason = "manual") {
  assertPermission(canManageBackups(user), "You do not have permission to create backups.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await ensureBackupRoot();
  const filename = await backupFilename();
  const filePath = path.join(backupRoot, filename);

  try {
    const payload = await exportData();
    const manifest = {
      app: "liax_space",
      archiveVersion: backupVersion,
      exportedAt: payload.exportedAt,
      siteTitle: await getBackupSiteTitle(),
      includes: ["database", "uploads"]
    };
    const database = Buffer.from(JSON.stringify(payload, null, 2), "utf8");
    const archive = createTarGzArchive([
      { path: "manifest.json", data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8") },
      { path: "database.json", data: database },
      ...(await collectUploads())
    ]);

    await writeFile(filePath, archive);
    const fileStat = await stat(filePath);
    const record = await db.backupRecord.create({
      data: {
        filename,
        filePath,
        sizeBytes: fileStat.size,
        reason,
        createdById: user.id
      }
    });
    if (reason === "scheduled-cli") {
      const { config } = await getBackupScheduleConfig(user);
      await pruneScheduledBackups(config.retentionDays);
    }
    return record;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed.";
    const record = await db.backupRecord.create({
      data: {
        filename,
        filePath,
        sizeBytes: 0,
        status: BackupStatus.FAILED,
        reason,
        error: message,
        createdById: user.id
      }
    });
    if (reason === "scheduled-cli") {
      const { config } = await getBackupScheduleConfig(user);
      await pruneScheduledBackups(config.retentionDays);
    }
    return record;
  }
}

export async function getBackupFile(user: CurrentUser, id: string) {
  assertPermission(canManageBackups(user), "You do not have permission to download backups.");
  const backup = await db.backupRecord.findUnique({ where: { id } });

  if (!backup || backup.status !== BackupStatus.READY) {
    throw new Error("Backup not found.");
  }

  const filePath = safeBackupPath(backup.filePath);

  return {
    backup,
    bytes: await readFile(filePath)
  };
}

export async function getBackupFileDownload(user: CurrentUser, id: string) {
  assertPermission(canManageBackups(user), "You do not have permission to download backups.");
  const backup = await db.backupRecord.findUnique({ where: { id } });

  if (!backup || backup.status !== BackupStatus.READY) {
    throw new Error("Backup not found.");
  }

  const filePath = safeBackupPath(backup.filePath);
  const fileStat = await stat(filePath);

  return {
    backup,
    filePath,
    sizeBytes: fileStat.size
  };
}

export async function importBackupFile(user: CurrentUser, originalName: string, bytes: Buffer) {
  assertPermission(canManageBackups(user), "You do not have permission to upload backups.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }
  if (bytes.length <= 0) {
    throw new Error("备份文件为空。");
  }

  try {
    const { payload } = parseBackupPayload(bytes);
    if (![backupVersion, legacyJsonBackupVersion].includes(payload.version) || !payload.data) {
      throw new Error("Unsupported backup file.");
    }
  } catch {
    throw new Error("备份文件格式不正确，未找到可还原的数据。");
  }

  await ensureBackupRoot();
  const filename = uploadedBackupFilename(originalName);
  const filePath = path.join(backupRoot, filename);
  await writeFile(filePath, bytes);
  const fileStat = await stat(filePath);

  return db.backupRecord.create({
    data: {
      filename,
      filePath,
      sizeBytes: fileStat.size,
      reason: "uploaded",
      createdById: user.id
    }
  });
}

export async function deleteBackup(user: CurrentUser, id: string) {
  assertPermission(canManageBackups(user), "You do not have permission to delete backups.");
  const backup = await db.backupRecord.findUnique({ where: { id } });

  if (!backup) {
    throw new Error("Backup not found.");
  }

  const filePath = safeBackupPath(backup.filePath);
  await db.backupRecord.delete({ where: { id } });
  await unlink(filePath).catch(() => undefined);
}

export async function restoreBackup(user: CurrentUser, bytes: Buffer) {
  assertPermission(canManageBackups(user), "You do not have permission to restore backups.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const { payload, uploadEntries, hasUploadSnapshot } = parseBackupPayload(bytes);
  if (![backupVersion, legacyJsonBackupVersion].includes(payload.version) || !payload.data) {
    throw new Error("Unsupported backup file.");
  }

  const stagedUploadRestore = await stageUploadEntries(uploadEntries, hasUploadSnapshot);
  try {
    await createBackup(user, "pre-restore");
    const data = payload.data;

    await db.$transaction(async (tx) => {
      await tx.mediaReference.deleteMany();
      await tx.visitLog.deleteMany();
      await tx.momentComment.deleteMany();
      await tx.momentLike.deleteMany();
      await tx.comment.deleteMany();
      await tx.articleAllowedIdentity.deleteMany();
      await tx.articleTag.deleteMany();
      await tx.articleTranslationJob.deleteMany();
      await tx.articleContent.deleteMany();
      await tx.articleTranslation.deleteMany();
      await tx.publicContentTranslationJob.deleteMany();
      await tx.publicContentTranslation.deleteMany();
      await tx.articleVersion.deleteMany();
      await tx.moment.deleteMany();
      await tx.article.deleteMany();
      await tx.tag.deleteMany();
      await tx.guestbookLike.deleteMany();
      await tx.guestbookComment.deleteMany();
      await tx.guestbookMessage.deleteMany();
      await tx.mailSendLog.deleteMany();
      await tx.mailTemplate.deleteMany();
      await tx.setting.deleteMany();
      await tx.passkeyCredential.deleteMany();
      await tx.totpRecoveryCode.deleteMany();
      await tx.webAuthnChallenge.deleteMany();
      await tx.authSession.deleteMany();
      await tx.loginEvent.deleteMany();
      await tx.pendingAuth.deleteMany();
      await tx.trustedDevice.deleteMany();
      await tx.verificationCode.deleteMany();
      await tx.mediaAsset.deleteMany();
      await tx.user.deleteMany();
      await tx.identity.deleteMany();

      await insertRows(tx.identity, asRows(data, "identities"));
      await insertRows(tx.user, asRows(data, "users"));
      await insertRows(tx.authSession, asRows(data, "authSessions"));
      await insertRows(tx.loginEvent, asRows(data, "loginEvents"));
      await insertRows(tx.pendingAuth, asRows(data, "pendingAuths"));
      await insertRows(tx.trustedDevice, asRows(data, "trustedDevices"));
      await insertRows(tx.verificationCode, asRows(data, "verificationCodes"));
      await insertRows(tx.passkeyCredential, asRows(data, "passkeyCredentials"));
      await insertRows(tx.totpRecoveryCode, asRows(data, "totpRecoveryCodes"));
      await insertRows(tx.webAuthnChallenge, asRows(data, "webauthnChallenges"));
      await insertRows(tx.setting, asRows(data, "settings"));
      await insertRows(tx.mailTemplate, asRows(data, "mailTemplates"));
      await insertRows(tx.mailSendLog, asRows(data, "mailSendLogs"));
      await insertRows(tx.tag, asRows(data, "tags"));
      await insertRows(tx.article, asRows(data, "articles"));
      await insertRows(tx.articleAllowedIdentity, asRows(data, "articleAllowedIdentities"));
      await insertRows(tx.articleTag, asRows(data, "articleTags"));
      await insertRows(tx.articleVersion, asRows(data, "articleVersions"));
      await insertRows(tx.articleContent, asRows(data, "articleContents"));
      await insertRows(tx.articleTranslation, asRows(data, "articleTranslations"));
      await insertRows(tx.articleTranslationJob, asRows(data, "articleTranslationJobs"));
      await insertRows(tx.publicContentTranslation, asRows(data, "publicContentTranslations"));
      await insertRows(tx.publicContentTranslationJob, asRows(data, "publicContentTranslationJobs"));
      await insertRows(tx.comment, asRows(data, "comments"));
      await insertRows(tx.moment, asRows(data, "moments"));
      await insertRows(tx.momentLike, asRows(data, "momentLikes"));
      await insertRows(tx.momentComment, asRows(data, "momentComments"));
      await insertRows(tx.guestbookMessage, asRows(data, "guestbookMessages"));
      await insertRows(tx.guestbookComment, asRows(data, "guestbookComments"));
      await insertRows(tx.guestbookLike, asRows(data, "guestbookLikes"));
      await insertRows(tx.visitLog, asRows(data, "visitLogs"));
      await insertRows(tx.mediaAsset, asRows(data, "mediaAssets"));
      await insertRows(tx.mediaReference, asRows(data, "mediaReferences"));
    }, { timeout: 60_000 });

    await writeStagedUploadEntries(stagedUploadRestore);
  } catch (error) {
    if (stagedUploadRestore) {
      await rm(stagedUploadRestore.restoreRoot, { recursive: true, force: true }).catch(() => undefined);
    }
    throw error;
  }
}

export async function restoreBackupFromId(user: CurrentUser, id: string) {
  assertPermission(canManageBackups(user), "You do not have permission to restore backups.");
  const backup = await db.backupRecord.findUnique({ where: { id } });

  if (!backup || backup.status !== BackupStatus.READY) {
    throw new Error("Backup not found or not ready.");
  }

  return restoreBackup(user, await readFile(safeBackupPath(backup.filePath)));
}
