import "server-only";

import {
  db,
  describeDatabaseError,
  getDatabaseConfigDiagnostics,
  isDatabaseConfigured
} from "@/lib/db";

export async function checkDatabaseHealth() {
  const diagnostics = getDatabaseConfigDiagnostics();
  const base = {
    source: diagnostics.source,
    host: diagnostics.host,
    port: diagnostics.port,
    database: diagnostics.database,
    user: diagnostics.user,
    missingMysqlEnv: diagnostics.missingMysqlEnv
  };

  if (!isDatabaseConfigured()) {
    return {
      ...base,
      status: "critical" as const,
      configured: false,
      latencyMs: null,
      error: "DATABASE_URL is not configured."
    };
  }

  if (diagnostics.databaseUrlInvalid) {
    return {
      ...base,
      status: "critical" as const,
      configured: true,
      latencyMs: null,
      error: "DATABASE_URL is invalid."
    };
  }

  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      db.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Database health query timed out after 1500ms.")), 1500);
      })
    ]);

    return {
      ...base,
      status: "ok" as const,
      configured: true,
      latencyMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      ...base,
      status: "critical" as const,
      configured: true,
      latencyMs: null,
      error: describeDatabaseError(error)
    };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
