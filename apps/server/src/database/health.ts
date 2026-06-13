import { getDatabasePool } from "./connection.js";

export type DatabaseHealthStatus = "ok" | "unavailable";

export type DatabaseHealth = {
  status: DatabaseHealthStatus;
  checkedAt: string;
};

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  try {
    await getDatabasePool().query("SELECT 1");

    return {
      status: "ok",
      checkedAt: new Date().toISOString()
    };
  } catch {
    return {
      status: "unavailable",
      checkedAt: new Date().toISOString()
    };
  }
}

