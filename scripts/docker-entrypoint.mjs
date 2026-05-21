import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, lchown, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { Prisma, PrismaClient } = require("@prisma/client");

const STORAGE_DIR = process.env.APP_STORAGE_DIR || "/app/storage";
const CONFIG_DIR = process.env.SETUP_CONFIG_DIR || "/app/storage/config";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/app/public/uploads";
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(STORAGE_DIR, "backups");
const CACHE_DIR = process.env.CACHE_DIR || path.join(STORAGE_DIR, "cache");
const TOKEN_FILE = path.join(CONFIG_DIR, "setup-token");
const STATUS_FILE = path.join(CONFIG_DIR, "setup-status.json");
const PRISMA_BIN = process.env.PRISMA_BIN || "/opt/prisma-cli/node_modules/prisma/build/index.js";
const WORKER_BUNDLE = process.env.WORKER_BUNDLE || ".next/worker/worker.mjs";
const DATABASE_BOOTSTRAP_ATTEMPTS = Number.parseInt(process.env.DATABASE_BOOTSTRAP_ATTEMPTS || "45", 10);
const DATABASE_BOOTSTRAP_INTERVAL_SECONDS = Number.parseInt(process.env.DATABASE_BOOTSTRAP_INTERVAL_SECONDS || "2", 10);
const RUNTIME_UID = "1001";
const RUNTIME_GID = "1001";

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}

async function assertWritable(directory) {
  const probe = path.join(directory, `.write-test-${process.pid}-${randomBytes(4).toString("hex")}`);
  await writeFile(probe, "");
  await rm(probe, { force: true });
}

function isRoot() {
  return typeof process.getuid === "function" && process.getuid() === 0;
}

async function chownPath(target) {
  await lchown(target, Number(RUNTIME_UID), Number(RUNTIME_GID));
}

async function chownRecursive(target) {
  await chownPath(target);

  let entries;
  try {
    entries = await readdir(target, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOTDIR") {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await chownRecursive(child);
    } else {
      await chownPath(child);
    }
  }
}

function dropRuntimePrivileges() {
  if (!isRoot()) {
    return;
  }

  try {
    process.setgid(Number(RUNTIME_GID));
    process.setuid(Number(RUNTIME_UID));
    console.log(`[setup] Dropped runtime privileges to UID/GID ${RUNTIME_UID}:${RUNTIME_GID}.`);
  } catch (error) {
    console.error("[setup] Failed to drop runtime privileges.");
    console.error(`[setup] ${describeError(error)}`);
    process.exit(1);
  }
}

async function prepareRuntimeDirs() {
  const directories = [STORAGE_DIR, CONFIG_DIR, BACKUP_DIR, CACHE_DIR, UPLOAD_DIR];

  try {
    await Promise.all(directories.map((directory) => mkdir(directory, { recursive: true })));
    if (isRoot()) {
      await Promise.all([chownRecursive(STORAGE_DIR), chownRecursive(UPLOAD_DIR)]);
      dropRuntimePrivileges();
    }
    await Promise.all(directories.map((directory) => assertWritable(directory)));
  } catch (error) {
    console.error("[setup] Runtime data directories are not writable by the application user.");
    console.error(`[setup] ${describeError(error)}`);
    console.error(
      `[setup] Ensure host storage and uploads mounts are writable by UID/GID ${RUNTIME_UID}:${RUNTIME_GID}.`,
    );
    console.error(
      `[setup] Example: chown -R ${RUNTIME_UID}:${RUNTIME_GID} "$APP_PATH/data/storage" "$APP_PATH/data/uploads"`,
    );
    process.exit(1);
  }
}

function cliEntry(cliPath) {
  const normalized = cliPath.replaceAll("\\", "/");

  if (normalized.endsWith("/.bin/prisma")) {
    return path.join(path.dirname(path.dirname(cliPath)), "prisma", "build", "index.js");
  }

  if (normalized.endsWith("/.bin/tsx")) {
    return path.join(path.dirname(path.dirname(cliPath)), "tsx", "dist", "cli.mjs");
  }

  return cliPath;
}

function runNodeCli(cliPath, args) {
  return runCommand(process.execPath, [cliEntry(cliPath), ...args]);
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", (error) => {
      console.error(`[setup] Failed to start ${command}: ${describeError(error)}`);
      resolve(1);
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        resolve(128 + (signal === "SIGINT" ? 2 : signal === "SIGTERM" ? 15 : 0));
        return;
      }
      resolve(code ?? 0);
    });
  });
}

function execRuntime(command, args) {
  const child = spawn(command, args, {
    env: process.env,
    stdio: "inherit",
  });

  const forwardSigint = () => {
    if (!child.killed) {
      child.kill("SIGINT");
    }
  };
  const forwardSigterm = () => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  };

  process.on("SIGINT", forwardSigint);
  process.on("SIGTERM", forwardSigterm);

  child.on("error", (error) => {
    console.error(`[setup] Failed to start runtime: ${describeError(error)}`);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    process.off("SIGINT", forwardSigint);
    process.off("SIGTERM", forwardSigterm);

    if (signal === "SIGINT") {
      process.exit(130);
    }
    if (signal === "SIGTERM") {
      process.exit(143);
    }
    process.exit(code ?? 0);
  });
}

function startRuntime(args) {
  if (args[0] === "worker") {
    process.env.BACKGROUND_WORKER_ROLE ||= "worker";
    console.log("[setup] Starting background worker.");
    execRuntime(process.execPath, [WORKER_BUNDLE]);
    return;
  }

  execRuntime(process.execPath, ["server.js"]);
}

async function checkDatabaseConnection() {
  const prisma = new PrismaClient({ log: [] });

  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error(describeError(error));
    return false;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

async function waitForDatabaseConnection() {
  for (let attempt = 1; attempt <= DATABASE_BOOTSTRAP_ATTEMPTS; attempt += 1) {
    if (await checkDatabaseConnection()) {
      return true;
    }

    if (attempt < DATABASE_BOOTSTRAP_ATTEMPTS) {
      console.log(
        `[setup] Database is not ready yet. Retrying in ${DATABASE_BOOTSTRAP_INTERVAL_SECONDS}s (${attempt}/${DATABASE_BOOTSTRAP_ATTEMPTS}).`,
      );
      await sleep(DATABASE_BOOTSTRAP_INTERVAL_SECONDS * 1000);
    }
  }

  return false;
}

function deriveDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const { MYSQL_DATABASE, MYSQL_HOST, MYSQL_PASSWORD, MYSQL_USER } = process.env;
  if (!MYSQL_HOST || !MYSQL_DATABASE || !MYSQL_USER || !MYSQL_PASSWORD) {
    return;
  }

  const url = new URL("mysql://localhost");
  url.hostname = MYSQL_HOST;
  url.port = process.env.MYSQL_PORT || "3306";
  url.username = MYSQL_USER;
  url.password = MYSQL_PASSWORD;
  url.pathname = `/${MYSQL_DATABASE}`;
  process.env.DATABASE_URL = url.toString();
  console.log("[setup] DATABASE_URL derived from MYSQL_* environment variables.");
}

function logDatabaseUrlRequirements() {
  const required = ["MYSQL_HOST", "MYSQL_DATABASE", "MYSQL_USER", "MYSQL_PASSWORD"];
  const missing = required.filter((name) => !process.env[name]);

  console.log("[setup] DATABASE_URL is not configured and could not be derived from MYSQL_*.");
  if (missing.length > 0) {
    console.log(`[setup] Missing MYSQL_* variables in the app container: ${missing.join(" ")}`);
    console.log("[setup] Compose reminder: variables set on the mysql service are not visible to the app service.");
    console.log("[setup] Add MYSQL_PASSWORD: ${MYSQL_PASSWORD} to services.app.environment or provide DATABASE_URL.");
  } else {
    console.log("[setup] MYSQL_* variables are present, but DATABASE_URL generation did not complete.");
  }
}

async function writeStatus(state, error) {
  const payload = {
    state,
    updatedAt: new Date().toISOString(),
    error: error || undefined,
    siteUrl: process.env.SITE_URL || undefined,
    databaseHost: process.env.MYSQL_HOST || undefined,
    databaseName: process.env.MYSQL_DATABASE || undefined,
  };

  await mkdir(path.dirname(STATUS_FILE), { recursive: true });
  await writeFile(STATUS_FILE, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
}

function databaseNameFromUrl() {
  try {
    return decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.replace(/^\//, ""));
  } catch {
    return process.env.MYSQL_DATABASE || "";
  }
}

async function checkInstallationExists() {
  const prisma = new PrismaClient();
  const requiredTables = ["SystemInstallation", "User"];

  try {
    const rows = await prisma.$queryRaw`
      SELECT TABLE_NAME AS tableName
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ${databaseNameFromUrl()}
        AND TABLE_NAME IN (${Prisma.join(requiredTables)})
    `;
    const existing = new Set(rows.map((row) => row.tableName ?? row.TABLE_NAME));

    if (!requiredTables.every((table) => existing.has(table))) {
      return false;
    }

    const installation = await prisma.systemInstallation.findUnique({ where: { id: "main" } });
    if (installation?.installed) {
      return true;
    }

    const adminCount = await prisma.user.count({ where: { role: "Administer" } });
    return adminCount > 0;
  } catch {
    return false;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

async function generateSetupToken() {
  if (process.env.SETUP_TOKEN) {
    return;
  }

  if (existsSync(TOKEN_FILE)) {
    process.env.SETUP_TOKEN = (await readFile(TOKEN_FILE, "utf8")).trim();
    return;
  }

  process.env.SETUP_TOKEN = randomBytes(24).toString("hex");
  await mkdir(path.dirname(TOKEN_FILE), { recursive: true });
  await writeFile(TOKEN_FILE, `${process.env.SETUP_TOKEN}\n`, { mode: 0o600 });
  await chmod(TOKEN_FILE, 0o600).catch(() => {});

  console.log(`[setup] Generated one-time setup token. Read it from ${TOKEN_FILE} or this log line:`);
  console.log(`[setup] SETUP_TOKEN=${process.env.SETUP_TOKEN}`);
}

async function cleanupSetupFiles() {
  await Promise.all([rm(TOKEN_FILE, { force: true }), rm(STATUS_FILE, { force: true })]);
}

async function enterSetupMode(args, status, error, message) {
  if (status) {
    await writeStatus(status, error);
  }
  await generateSetupToken();
  console.log(message);
  console.log(`[setup] Open /setup and use SETUP_TOKEN from env, ${TOKEN_FILE}, or the log above.`);
  process.env.SETUP_REQUIRED = "true";
  startRuntime(args);
}

async function main() {
  const args = process.argv.slice(2);

  await prepareRuntimeDirs();
  deriveDatabaseUrl();

  if (!process.env.DATABASE_URL) {
    logDatabaseUrlRequirements();
    await enterSetupMode(
      args,
      "database-url-missing",
      "DATABASE_URL is not configured and could not be derived from MYSQL_* in the app container.",
      "[setup] DATABASE_URL is not configured. Starting setup-safe web server.",
    );
    return;
  }

  if (!(await waitForDatabaseConnection())) {
    await enterSetupMode(
      args,
      "migration-failed",
      "Database was not reachable during startup.",
      "[setup] Database did not become ready during startup. Starting setup-safe web server.",
    );
    return;
  }

  console.log("[setup] DATABASE_URL detected. Running production migrations.");
  if ((await runNodeCli(PRISMA_BIN, ["migrate", "deploy"])) === 0) {
    console.log("[setup] Prisma migrations applied.");
  } else {
    console.log("[setup] Prisma migrate deploy failed. Falling back to db push.");

    if (await checkInstallationExists()) {
      console.log("[setup] Existing installation detected. Skipping db push and starting normal web server.");
      await cleanupSetupFiles();
      startRuntime(args);
      return;
    }

    if ((await runNodeCli(PRISMA_BIN, ["db", "push", "--accept-data-loss"])) === 0) {
      console.log("[setup] Prisma db push completed successfully.");
    } else {
      await enterSetupMode(
        args,
        "migration-failed",
        "Database migration and schema push both failed. Check database permissions, connection settings, and logs.",
        "[setup] Prisma db push also failed. Starting setup-safe web server.",
      );
      return;
    }
  }

  if (process.env.RUN_SEED === "true") {
    console.log("[setup] RUN_SEED=true, running Prisma seed.");
    if ((await runNodeCli(PRISMA_BIN, ["db", "seed"])) !== 0) {
      console.log("[setup] Prisma seed failed. The app will still start; inspect logs before production use.");
    }
  }

  if (await checkInstallationExists()) {
    console.log("[setup] System is already installed (SystemInstallation record or Administer user found).");
    await cleanupSetupFiles();
    startRuntime(args);
    return;
  }

  await generateSetupToken();
  console.log("[setup] Database migrated but no installation record found. Starting setup wizard.");
  console.log(`[setup] Open /setup and use SETUP_TOKEN from env, ${TOKEN_FILE}, or the log above.`);
  process.env.SETUP_REQUIRED = "true";
  startRuntime(args);
}

main().catch((error) => {
  console.error(`[setup] Startup failed: ${describeError(error)}`);
  process.exit(1);
});
