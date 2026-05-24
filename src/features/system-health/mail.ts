import { MailSendStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { readSettings } from "@/features/system-health/settings";
import type { SystemHealthReport } from "@/features/system-health/types";
import { countByStatus, errorMessage, worstStatus } from "@/features/system-health/utils";

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

export async function collectMailHealth(databaseOk: boolean): Promise<SystemHealthReport["mail"]> {
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
      source: envConfig.ready ? "environment" : "none",
      ...envConfig,
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
    const mailRows = await db.mailSendLog.groupBy({
      by: ["status"],
      where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      _count: { _all: true }
    });
    const mailCounts = countByStatus(Object.values(MailSendStatus), mailRows);
    const notificationsEnabled = settings["smtp.notificationsEnabled"] !== "false";

    return {
      status: worstStatus([
        notificationsEnabled && !activeConfig.ready ? "warning" : "ok",
        mailCounts.FAILED > 0 ? "warning" : "ok"
      ]),
      notificationsEnabled,
      source,
      ...activeConfig,
      failedLast24Hours: mailCounts.FAILED,
      skippedLast24Hours: mailCounts.SKIPPED
    };
  } catch (error) {
    return {
      status: "warning",
      notificationsEnabled: true,
      source: envConfig.ready ? "environment" : "none",
      ...envConfig,
      failedLast24Hours: 0,
      skippedLast24Hours: 0,
      error: errorMessage(error)
    };
  }
}
