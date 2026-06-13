import { createPool, type Pool } from "mysql2/promise";
import { env } from "../config/index.js";

let pool: Pool | null = null;

export function getDatabasePool(): Pool {
  if (!pool) {
    pool = createPool({
      host: env.database.host,
      port: env.database.port,
      database: env.database.name,
      user: env.database.user,
      password: env.database.password,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true
    });
  }

  return pool;
}

export async function closeDatabasePool(): Promise<void> {
  if (!pool) {
    return;
  }

  const currentPool = pool;
  pool = null;
  await currentPool.end();
}

