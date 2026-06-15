import { createPool } from "mysql2/promise";

import { closeDatabasePool, getDatabasePool } from "../database/connection.js";
import { LegacyPublicDataSyncJob } from "./LegacyPublicDataSyncJob.js";

const legacyDatabaseConnectTimeoutMs = 10_000;

type LegacyDatabaseEnv = {
  database: string;
  host: string;
  password: string;
  port: number;
  user: string;
};

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function readLegacyDatabaseEnv(): LegacyDatabaseEnv {
  const port = Number(process.env.LEGACY_DATABASE_PORT ?? "3306");
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("LEGACY_DATABASE_PORT must be a positive integer.");
  }

  return {
    database: process.env.LEGACY_DATABASE_NAME ?? "liax_space",
    host: readRequiredEnv("LEGACY_DATABASE_HOST"),
    password: readRequiredEnv("LEGACY_DATABASE_PASSWORD"),
    port,
    user: readRequiredEnv("LEGACY_DATABASE_USER")
  };
}

function logProgress(message: string): void {
  console.error(`[legacy-sync] ${message}`);
}

async function main(): Promise<void> {
  const apply = process.argv.slice(2).includes("--apply");
  const legacyEnv = readLegacyDatabaseEnv();
  logProgress(`starting ${apply ? "apply" : "dry-run"}`);
  const legacyPool = createPool({
    database: legacyEnv.database,
    host: legacyEnv.host,
    password: legacyEnv.password,
    port: legacyEnv.port,
    user: legacyEnv.user,
    waitForConnections: true,
    connectionLimit: 2,
    connectTimeout: legacyDatabaseConnectTimeoutMs
  });

  logProgress("connecting target database");
  const targetConnection = await getDatabasePool().getConnection();
  logProgress("connected target database");

  try {
    const result = await new LegacyPublicDataSyncJob(legacyPool, targetConnection).run({ apply, onProgress: logProgress });
    console.log(JSON.stringify(result, null, 2));
    logProgress("finished");

    if (!apply) {
      console.error("Dry run only. Re-run with --apply after explicit approval to write target data.");
    }
  } finally {
    targetConnection.release();
    await legacyPool.end();
    await closeDatabasePool();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown legacy public data sync failure.");
  process.exitCode = 1;
});
