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
const scheduleEnabledKey = "backup.schedule.enabled";
const scheduleFrequencyKey = "backup.schedule.frequency";
const scheduleGroup = "Data and Backup";

export type BackupScheduleFrequency = "daily" | "weekly" | "monthly";

export type BackupScheduleConfig = {
  enabled: boolean;
  frequency: BackupScheduleFrequency;
};

async function ensureBackupRoot() {
  await mkdir(backupRoot, { recursive: true });
}

function safeFilenameSegment(value: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug || "liax-space";
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
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${safeFilenameSegment(await getBackupSiteTitle())}-${stamp}.tar.gz`;
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

async function exportData() {
  return {
    version: backupVersion,
    exportedAt: new Date().toISOString(),
    data: {
      identities: await db.identity.findMany(),
      users: await db.user.findMany(),
      authSessions: await db.authSession.findMany(),
      pendingAuths: await db.pendingAuth.findMany(),
      trustedDevices: await db.trustedDevice.findMany(),
      verificationCodes: await db.verificationCode.findMany(),
      passkeyCredentials: await db.passkeyCredential.findMany(),
      totpRecoveryCodes: await db.totpRecoveryCode.findMany(),
      webauthnChallenges: await db.webAuthnChallenge.findMany(),
      settings: await db.setting.findMany(),
      mailTemplates: await db.mailTemplate.findMany(),
      mailSendLogs: await db.mailSendLog.findMany(),
      tags: await db.tag.findMany(),
      articles: await db.article.findMany(),
      articleAllowedIdentities: await db.articleAllowedIdentity.findMany(),
      articleTags: await db.articleTag.findMany(),
      articleVersions: await db.articleVersion.findMany(),
      articleTranslations: await db.articleTranslation.findMany(),
      comments: await db.comment.findMany(),
      moments: await db.moment.findMany(),
      momentLikes: await db.momentLike.findMany(),
      momentComments: await db.momentComment.findMany(),
      guestbookMessages: await db.guestbookMessage.findMany(),
      visitLogs: await db.visitLog.findMany(),
      mediaAssets: await db.mediaAsset.findMany(),
      mediaReferences: await db.mediaReference.findMany()
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

async function writeUploadEntries(uploadEntries: BackupArchiveEntry[], hasUploadSnapshot: boolean) {
  if (!hasUploadSnapshot) {
    return;
  }

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

    await rm(uploadRoot, { recursive: true, force: true });
    await mkdir(path.dirname(uploadRoot), { recursive: true });
    await copyDirectory(stagedUploads, uploadRoot);
  } finally {
    await rm(restoreRoot, { recursive: true, force: true }).catch(() => undefined);
  }
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

export async function getBackupScheduleConfig(user: CurrentUser) {
  assertPermission(canManageBackups(user), "You do not have permission to manage backup schedules.");

  if (!isDatabaseConfigured()) {
    return {
      config: { enabled: false, frequency: "daily" as BackupScheduleFrequency },
      error: "DATABASE_URL is not configured."
    };
  }

  try {
    const settings = await db.setting.findMany({
      where: { key: { in: [scheduleEnabledKey, scheduleFrequencyKey] } }
    });
    const map = new Map(settings.map((setting) => [setting.key, setting.value]));
    const rawFrequency = map.get(scheduleFrequencyKey);
    const frequency: BackupScheduleFrequency =
      rawFrequency === "weekly" || rawFrequency === "monthly" ? rawFrequency : "daily";

    return {
      config: {
        enabled: map.get(scheduleEnabledKey) === "true",
        frequency
      },
      error: null as string | null
    };
  } catch (error) {
    console.error("Failed to read backup schedule config", error);
    return {
      config: { enabled: false, frequency: "daily" as BackupScheduleFrequency },
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
        frequency: String(input.get("frequency") ?? "daily")
      }
    : input as Partial<{ enabled: boolean; frequency: string }>;
  const frequency: BackupScheduleFrequency =
    data.frequency === "weekly" || data.frequency === "monthly" ? data.frequency : "daily";

  await db.$transaction([
    db.setting.upsert({
      where: { key: scheduleEnabledKey },
      update: { value: data.enabled ? "true" : "false" },
      create: {
        key: scheduleEnabledKey,
        value: data.enabled ? "true" : "false",
        group: scheduleGroup,
        type: SettingType.BOOLEAN
      }
    }),
    db.setting.upsert({
      where: { key: scheduleFrequencyKey },
      update: { value: frequency },
      create: {
        key: scheduleFrequencyKey,
        value: frequency,
        group: scheduleGroup,
        type: SettingType.TEXT
      }
    })
  ]);

  return { enabled: Boolean(data.enabled), frequency };
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
    return db.backupRecord.create({
      data: {
        filename,
        filePath,
        sizeBytes: fileStat.size,
        reason,
        createdById: user.id
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed.";
    return db.backupRecord.create({
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
    await tx.articleTranslation.deleteMany();
    await tx.articleVersion.deleteMany();
    await tx.moment.deleteMany();
    await tx.article.deleteMany();
    await tx.tag.deleteMany();
    await tx.guestbookMessage.deleteMany();
    await tx.mailSendLog.deleteMany();
    await tx.mailTemplate.deleteMany();
    await tx.setting.deleteMany();
    await tx.passkeyCredential.deleteMany();
    await tx.totpRecoveryCode.deleteMany();
    await tx.webAuthnChallenge.deleteMany();
    await tx.authSession.deleteMany();
    await tx.pendingAuth.deleteMany();
    await tx.trustedDevice.deleteMany();
    await tx.verificationCode.deleteMany();
    await tx.mediaAsset.deleteMany();
    await tx.user.deleteMany();
    await tx.identity.deleteMany();

    await insertRows(tx.identity, asRows(data, "identities"));
    await insertRows(tx.user, asRows(data, "users"));
    await insertRows(tx.authSession, asRows(data, "authSessions"));
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
    await insertRows(tx.articleTranslation, asRows(data, "articleTranslations"));
    await insertRows(tx.comment, asRows(data, "comments"));
    await insertRows(tx.moment, asRows(data, "moments"));
    await insertRows(tx.momentLike, asRows(data, "momentLikes"));
    await insertRows(tx.momentComment, asRows(data, "momentComments"));
    await insertRows(tx.guestbookMessage, asRows(data, "guestbookMessages"));
    await insertRows(tx.visitLog, asRows(data, "visitLogs"));
    await insertRows(tx.mediaAsset, asRows(data, "mediaAssets"));
    await insertRows(tx.mediaReference, asRows(data, "mediaReferences"));
  }, { timeout: 60_000 });

  await writeUploadEntries(uploadEntries, hasUploadSnapshot);
}

export async function restoreBackupFromId(user: CurrentUser, id: string) {
  assertPermission(canManageBackups(user), "You do not have permission to restore backups.");
  const backup = await db.backupRecord.findUnique({ where: { id } });

  if (!backup || backup.status !== BackupStatus.READY) {
    throw new Error("Backup not found or not ready.");
  }

  return restoreBackup(user, await readFile(safeBackupPath(backup.filePath)));
}
