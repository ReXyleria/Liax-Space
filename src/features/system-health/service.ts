import "server-only";

import type { CurrentUser } from "@/lib/auth";
import { shouldRunInProcessWorkers } from "@/lib/background-worker";
import { assertPermission, canManageSettings } from "@/lib/permissions";
import { getBackupRoot, getStorageRoot, getUploadRoot } from "@/lib/runtime-paths";
import { collectBackupHealth } from "@/features/system-health/backup";
import { checkDatabaseHealth } from "@/features/system-health/database";
import { checkRuntimeDirectory } from "@/features/system-health/directories";
import { collectMailHealth } from "@/features/system-health/mail";
import { collectQueueHealth } from "@/features/system-health/queues";
import { collectSecurityHealth } from "@/features/system-health/security";
import type { SystemHealthReport } from "@/features/system-health/types";
import { worstStatus } from "@/features/system-health/utils";

function activeQueueCount(report: Pick<SystemHealthReport, "queues">) {
  return report.queues.article.QUEUED
    + report.queues.article.RUNNING
    + report.queues.publicContent.QUEUED
    + report.queues.publicContent.RUNNING;
}

export async function getSystemHealthReport(user: CurrentUser): Promise<SystemHealthReport> {
  assertPermission(canManageSettings(user), "You do not have permission to view system health.");

  const database = await checkDatabaseHealth();
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
      checkRuntimeDirectory("storage", getStorageRoot()),
      checkRuntimeDirectory("uploads", getUploadRoot()),
      checkRuntimeDirectory("backups", getBackupRoot())
    ]),
    collectBackupHealth(databaseOk),
    collectQueueHealth(databaseOk),
    collectMailHealth(databaseOk),
    collectSecurityHealth(databaseOk)
  ]);
  const report = {
    generatedAt: new Date(),
    overallStatus: "ok",
    runtime,
    database,
    directories,
    backup,
    queues,
    mail,
    security
  } satisfies Omit<SystemHealthReport, "overallStatus"> & { overallStatus: "ok" };
  const workerQueueStatus =
    runtime.workerMode === "external" && runtime.workerRole !== "worker" && activeQueueCount(report) > 0
      ? "warning"
      : "ok";

  return {
    ...report,
    overallStatus: worstStatus([
      database.status,
      ...directories.map((directory) => directory.status),
      backup.status,
      queues.status,
      mail.status,
      security.status,
      workerQueueStatus
    ])
  };
}
