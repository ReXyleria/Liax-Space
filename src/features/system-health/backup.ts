import { BackupStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  backupScheduleSettingKeys,
  defaultBackupScheduleTime,
  normalizeScheduleTime,
  type BackupScheduleFrequency
} from "@/features/backup/service";
import { readSettings } from "@/features/system-health/settings";
import type { SystemHealthReport } from "@/features/system-health/types";
import { errorMessage, worstStatus } from "@/features/system-health/utils";

function normalizeFrequency(value: unknown): BackupScheduleFrequency {
  return value === "weekly" || value === "monthly" ? value : "daily";
}

export async function collectBackupHealth(databaseOk: boolean): Promise<SystemHealthReport["backup"]> {
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
        select: { filename: true, sizeBytes: true, status: true, createdAt: true, error: true }
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

    return {
      status: worstStatus([
        !scheduleEnabled ? "warning" : "ok",
        !latestBackup ? "warning" : "ok",
        latestBackup?.status === BackupStatus.FAILED || failedLast7Days > 0 ? "warning" : "ok",
        lastRunStatus.startsWith("failed") ? "warning" : "ok"
      ]),
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
