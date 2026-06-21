import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { closeDatabasePool, getDatabasePool } from "./connection.js";

export type MigrationCommand = "latest" | "rollback" | "seed";

type AppliedMigrationRow = RowDataPacket & {
  name: string;
};

const currentFile = fileURLToPath(import.meta.url);
const serverRoot = path.resolve(path.dirname(currentFile), "../..");
const migrationsDir = path.join(serverRoot, "migrations");
const seedsDir = path.join(serverRoot, "seeds");
const migrationsTable = "_liax_migrations";

function readCommand(): MigrationCommand {
  const command = process.argv[2];

  if (command === "latest" || command === "rollback" || command === "seed") {
    return command;
  }

  throw new Error("Migration command must be one of: latest, rollback, seed.");
}

async function listSqlFiles(directory: string, suffix: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function readSqlFile(directory: string, fileName: string): Promise<string> {
  const sql = await readFile(path.join(directory, fileName), "utf8");
  const trimmed = sql.trim();

  if (!trimmed) {
    throw new Error(`SQL file is empty: ${fileName}`);
  }

  return trimmed;
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function runSqlFile(connection: PoolConnection, sql: string): Promise<void> {
  for (const statement of splitSqlStatements(sql)) {
    await connection.query(statement);
  }
}

async function ensureMigrationsTable(connection: PoolConnection): Promise<void> {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS ${migrationsTable} (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function readAppliedMigrations(connection: PoolConnection): Promise<Set<string>> {
  const [rows] = await connection.query<AppliedMigrationRow[]>(
    `SELECT name FROM ${migrationsTable} ORDER BY name ASC`
  );

  return new Set(rows.map((row) => row.name));
}

function migrationNameFromUpFile(fileName: string): string {
  return fileName.replace(/\.up\.sql$/, "");
}

function downFileFromMigrationName(name: string): string {
  return `${name}.down.sql`;
}

async function runLatest(connection: PoolConnection): Promise<void> {
  await ensureMigrationsTable(connection);

  const applied = await readAppliedMigrations(connection);
  const upFiles = await listSqlFiles(migrationsDir, ".up.sql");
  const pendingFiles = upFiles.filter((fileName) => !applied.has(migrationNameFromUpFile(fileName)));

  if (pendingFiles.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  for (const fileName of pendingFiles) {
    const name = migrationNameFromUpFile(fileName);
    const sql = await readSqlFile(migrationsDir, fileName);

    await connection.beginTransaction();
    try {
      await runSqlFile(connection, sql);
      await connection.query(`INSERT INTO ${migrationsTable} (name) VALUES (?)`, [name]);
      await connection.commit();
      console.log(`Applied migration: ${name}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
}

async function runRollback(connection: PoolConnection): Promise<void> {
  await ensureMigrationsTable(connection);

  const [rows] = await connection.query<AppliedMigrationRow[]>(
    `SELECT name FROM ${migrationsTable} ORDER BY name DESC LIMIT 1`
  );
  const latest = rows[0];

  if (!latest) {
    console.log("No applied migrations to roll back.");
    return;
  }

  const downFile = downFileFromMigrationName(latest.name);
  const sql = await readSqlFile(migrationsDir, downFile);

  await connection.beginTransaction();
  try {
    await runSqlFile(connection, sql);
    await connection.query(`DELETE FROM ${migrationsTable} WHERE name = ?`, [latest.name]);
    await connection.commit();
    console.log(`Rolled back migration: ${latest.name}`);
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function runSeed(connection: PoolConnection): Promise<void> {
  const seedFiles = await listSqlFiles(seedsDir, ".sql");

  if (seedFiles.length === 0) {
    console.log("No seed files found.");
    return;
  }

  for (const fileName of seedFiles) {
    const sql = await readSqlFile(seedsDir, fileName);
    await runSqlFile(connection, sql);
    console.log(`Applied seed: ${fileName}`);
  }
}

export async function runMigrations(command: MigrationCommand): Promise<void> {
  const connection = await getDatabasePool().getConnection();

  try {
    if (command === "latest") {
      await runLatest(connection);
      return;
    }

    if (command === "rollback") {
      await runRollback(connection);
      return;
    }

    await runSeed(connection);
  } finally {
    connection.release();
  }
}

async function main(): Promise<void> {
  await runMigrations(readCommand());
  await closeDatabasePool();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Migration failed.");
    process.exitCode = 1;
  });
}
