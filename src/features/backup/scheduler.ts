import { SettingType, UserRole } from "@prisma/client";
import { db, isDatabaseConfigured } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import {
  backupScheduleSettingKeys,
  createBackup,
  defaultBackupScheduleTime,
  normalizeScheduleTime,
  type BackupScheduleFrequency,
  scheduleGroup
} from "@/features/backup/service";

const checkIntervalMs = 60 * 1000;
let workerStarted = false;
let workerRunning = false;

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function localWeekKey(date: Date) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const dayOffset = Math.floor((date.getTime() - firstDay.getTime()) / 86400000);
  const week = Math.floor((dayOffset + firstDay.getDay()) / 7) + 1;
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function periodKey(date: Date, frequency: BackupScheduleFrequency) {
  if (frequency === "monthly") {
    return localMonthKey(date);
  }
  if (frequency === "weekly") {
    return localWeekKey(date);
  }
  return localDateKey(date);
}

function isAfterScheduleTime(date: Date, time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return date.getHours() * 60 + date.getMinutes() >= hour * 60 + minute;
}

function isScheduledDay(date: Date, frequency: BackupScheduleFrequency) {
  if (frequency === "monthly") {
    return date.getDate() === 1;
  }
  if (frequency === "weekly") {
    return date.getDay() === 1;
  }
  return true;
}

async function readSchedule() {
  const rows = await db.setting.findMany({
    where: {
      key: {
        in: [
          backupScheduleSettingKeys.enabled,
          backupScheduleSettingKeys.frequency,
          backupScheduleSettingKeys.retentionDays,
          backupScheduleSettingKeys.time,
          backupScheduleSettingKeys.lastRunDate
        ]
      }
    },
    select: { key: true, value: true }
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const rawFrequency = map.get(backupScheduleSettingKeys.frequency);
  const frequency: BackupScheduleFrequency =
    rawFrequency === "weekly" || rawFrequency === "monthly" ? rawFrequency : "daily";

  return {
    enabled: map.get(backupScheduleSettingKeys.enabled) !== "false",
    frequency,
    time: normalizeScheduleTime(map.get(backupScheduleSettingKeys.time) ?? defaultBackupScheduleTime),
    lastRunDate: map.get(backupScheduleSettingKeys.lastRunDate) ?? ""
  };
}

async function findBackupOwner(): Promise<CurrentUser | null> {
  return db.user.findFirst({
    where: { role: UserRole.Administer },
    orderBy: { createdAt: "asc" },
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
  });
}

async function writeScheduleRunState(period: string, status: string) {
  await db.$transaction([
    db.setting.upsert({
      where: { key: backupScheduleSettingKeys.lastRunDate },
      update: { value: period },
      create: {
        key: backupScheduleSettingKeys.lastRunDate,
        value: period,
        group: scheduleGroup,
        type: SettingType.TEXT
      }
    }),
    db.setting.upsert({
      where: { key: backupScheduleSettingKeys.lastRunAt },
      update: { value: new Date().toISOString() },
      create: {
        key: backupScheduleSettingKeys.lastRunAt,
        value: new Date().toISOString(),
        group: scheduleGroup,
        type: SettingType.TEXT
      }
    }),
    db.setting.upsert({
      where: { key: backupScheduleSettingKeys.lastRunStatus },
      update: { value: status },
      create: {
        key: backupScheduleSettingKeys.lastRunStatus,
        value: status,
        group: scheduleGroup,
        type: SettingType.TEXT
      }
    })
  ]);
}

export async function runDueScheduledBackup(now = new Date()) {
  if (!isDatabaseConfigured()) {
    return;
  }

  const schedule = await readSchedule();
  if (!schedule.enabled || !isScheduledDay(now, schedule.frequency) || !isAfterScheduleTime(now, schedule.time)) {
    return;
  }

  const currentPeriod = periodKey(now, schedule.frequency);
  if (schedule.lastRunDate === currentPeriod) {
    return;
  }

  const owner = await findBackupOwner();
  if (!owner) {
    await writeScheduleRunState(currentPeriod, "failed:no-owner");
    console.error("[backup-scheduler] No Administer user exists for scheduled backup attribution.");
    return;
  }

  await writeScheduleRunState(currentPeriod, "running");
  const backup = await createBackup(owner, "scheduled-cli");
  await writeScheduleRunState(currentPeriod, backup.status === "READY" ? "ready" : "failed");
}

export function ensureScheduledBackupWorker() {
  if (workerStarted || process.env.NEXT_PHASE === "phase-production-build" || !isDatabaseConfigured()) {
    return;
  }

  workerStarted = true;
  const tick = () => {
    if (workerRunning) {
      return;
    }
    workerRunning = true;
    runDueScheduledBackup()
      .catch((error) => console.error("[backup-scheduler] scheduled backup failed", error))
      .finally(() => {
        workerRunning = false;
      });
  };

  setTimeout(tick, 5000);
  setInterval(tick, checkIntervalMs);
}
