import "server-only";

import { LoginEventMethod, UserRole, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { SystemHealthReport } from "@/features/system-health/types";
import { errorMessage, worstStatus } from "@/features/system-health/utils";

export async function collectSecurityHealth(databaseOk: boolean): Promise<SystemHealthReport["security"]> {
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
      db.loginEvent.count({ where: { method: LoginEventMethod.SMTP_FAIL_OPEN, createdAt: { gte: since } } }),
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
