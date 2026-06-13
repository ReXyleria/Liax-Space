import { randomBytes, randomUUID } from "node:crypto";
import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

type CheckStatus = "OK" | "WARN" | "ERROR";

type CheckResult = {
  name: string;
  status: CheckStatus;
  message: string;
};

type EnvLoadResult = {
  found: boolean;
  loadedKeys: string[];
  path: string;
};

type MysqlModule = {
  createConnection(input: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    connectTimeout: number;
  }): Promise<{
    query(sql: string): Promise<unknown>;
    end(): Promise<void>;
  }>;
};

const projectRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const envPath = path.join(projectRoot, ".env");
const serverRequire = createRequire(path.join(projectRoot, "apps", "server", "package.json"));
const defaultSecretValues = new Set([
  "",
  "change-me",
  "default",
  "default-secret",
  "jwt-secret",
  "password-pepper",
  "secret"
]);

function stripOptionalQuotes(value: string): string {
  const trimmed = value.trim();

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

async function loadDotEnv(): Promise<EnvLoadResult> {
  let content = "";

  try {
    content = await readFile(envPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {
        found: false,
        loadedKeys: [],
        path: envPath
      };
    }

    throw error;
  }

  const loadedKeys: string[] = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = stripOptionalQuotes(line.slice(separatorIndex + 1));

    if (!process.env[key]) {
      process.env[key] = value;
      loadedKeys.push(key);
    }
  }

  return {
    found: true,
    loadedKeys,
    path: envPath
  };
}

function envValue(name: string): string | null {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function configValue(name: string, fallback: string): string {
  return envValue(name) ?? fallback;
}

function envCheck(loadResult: EnvLoadResult): CheckResult {
  if (loadResult.found) {
    return {
      name: ".env",
      status: "OK",
      message: `.env loaded from ${path.relative(projectRoot, loadResult.path)} (${loadResult.loadedKeys.length} new variable(s)).`
    };
  }

  return {
    name: ".env",
    status: "WARN",
    message: ".env was not found. The script will use variables already present in the process environment."
  };
}

function readPort(name: string, fallback: number): number | null {
  const rawValue = configValue(name, String(fallback));
  const value = rawValue === null ? NaN : Number(rawValue);

  return Number.isInteger(value) && value > 0 ? value : null;
}

async function checkDatabase(): Promise<CheckResult> {
  const port = readPort("DATABASE_PORT", 3306);

  if (port === null) {
    return {
      name: "database",
      status: "ERROR",
      message: "DATABASE_PORT must be a positive integer."
    };
  }

  let mysql: MysqlModule;

  try {
    mysql = serverRequire("mysql2/promise") as MysqlModule;
  } catch {
    return {
      name: "database",
      status: "ERROR",
      message: "mysql2 is not installed for apps/server, so the database connection could not be checked."
    };
  }

  let connection: Awaited<ReturnType<MysqlModule["createConnection"]>> | null = null;

  try {
    connection = await mysql.createConnection({
      connectTimeout: 3000,
      database: configValue("DATABASE_NAME", "liax_space"),
      host: configValue("DATABASE_HOST", "127.0.0.1"),
      password: configValue("DATABASE_PASSWORD", "root"),
      port,
      user: configValue("DATABASE_USER", "root")
    });
    await connection.query("SELECT 1");

    return {
      name: "database",
      status: "OK",
      message: "Database connection succeeded."
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database connection failure.";

    return {
      name: "database",
      status: "ERROR",
      message: `Database connection failed: ${message}`
    };
  } finally {
    if (connection) {
      await connection.end().catch(() => undefined);
    }
  }
}

async function checkWritableDirectory(name: string, envName: string): Promise<CheckResult> {
  const fallbackByEnvName: Record<string, string> = {
    STORAGE_RENDERED_DIR: "storage/rendered",
    STORAGE_RUNTIME_DIR: "storage/runtime",
    STORAGE_UPLOADS_DIR: "storage/uploads"
  };
  const configuredPath = configValue(envName, fallbackByEnvName[envName] ?? "");

  const absolutePath = path.resolve(projectRoot, configuredPath);
  const tempPath = path.join(absolutePath, `.check-env-${randomUUID()}.tmp`);

  try {
    await mkdir(absolutePath, { recursive: true });
    const directoryStat = await stat(absolutePath);

    if (!directoryStat.isDirectory()) {
      return {
        name,
        status: "ERROR",
        message: `${envName} is not a directory: ${absolutePath}`
      };
    }

    await access(absolutePath, constants.W_OK);
    await writeFile(tempPath, "ok", "utf8");
    await rm(tempPath, { force: true });

    return {
      name,
      status: "OK",
      message: `${envName} is writable: ${absolutePath}`
    };
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Unknown storage write failure.";

    return {
      name,
      status: "ERROR",
      message: `${envName} is not writable: ${message}`
    };
  }
}

async function checkRuntimeSecret(name: string, fileName: string): Promise<CheckResult> {
  const configuredValue = envValue(name);
  const runtimeDir = path.resolve(projectRoot, configValue("STORAGE_RUNTIME_DIR", "storage/runtime"));
  const secretPath = path.join(runtimeDir, fileName);
  let value = configuredValue;

  if (value === null) {
    try {
      value = (await readFile(secretPath, "utf8")).trim();
    } catch {
      await mkdir(runtimeDir, { recursive: true });
      value = randomBytes(32).toString("hex");
      await writeFile(secretPath, `${value}\n`, "utf8");
    }
  }

  if (defaultSecretValues.has(value.toLowerCase())) {
    return {
      name,
      status: "ERROR",
      message: `${name} still uses a default placeholder value.`
    };
  }

  return {
    name,
    status: "OK",
    message: `${name} is available from ${configuredValue ? "process environment" : path.relative(projectRoot, secretPath)} and is not a known default placeholder.`
  };
}

function statusRank(status: CheckStatus): number {
  if (status === "ERROR") {
    return 2;
  }

  return status === "WARN" ? 1 : 0;
}

function overallStatus(results: CheckResult[]): CheckStatus {
  return results.reduce<CheckStatus>((current, result) => {
    return statusRank(result.status) > statusRank(current) ? result.status : current;
  }, "OK");
}

function printResults(results: CheckResult[]): void {
  for (const result of results) {
    console.log(`${result.status} ${result.name} - ${result.message}`);
  }

  console.log(`${overallStatus(results)} summary - ${results.length} check(s) completed.`);
}

async function main(): Promise<void> {
  const dotEnvResult = await loadDotEnv();
  const results: CheckResult[] = [
    envCheck(dotEnvResult),
    await checkDatabase(),
    await checkWritableDirectory("storage/uploads", "STORAGE_UPLOADS_DIR"),
    await checkWritableDirectory("storage/rendered", "STORAGE_RENDERED_DIR"),
    await checkWritableDirectory("storage/runtime", "STORAGE_RUNTIME_DIR"),
    await checkRuntimeSecret("JWT_SECRET", "jwt-secret"),
    await checkRuntimeSecret("PASSWORD_PEPPER", "password-pepper")
  ];

  printResults(results);

  if (results.some((result) => result.status === "ERROR")) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown environment check failure.";
  console.error(`ERROR check-env - ${message}`);
  process.exitCode = 1;
});
