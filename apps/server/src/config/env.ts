import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type AppEnv = "development" | "test" | "production";

export type ServerEnv = {
  appEnv: AppEnv;
  appHost: string;
  appPort: number;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  jwtSecret: string;
  passwordPepper: string;
  storage: {
    uploadsDir: string;
    renderedDir: string;
    runtimeDir: string;
  };
  publicBaseUrl: string;
};

const configDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(configDir, "../../../..");

function readRequired(name: string): string {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readOptionalString(name: string, fallback: string): string {
  const value = process.env[name];

  return value && value.trim().length > 0 ? value.trim() : fallback;
}

function readInteger(name: string, fallback: number): number {
  const rawValue = readOptionalString(name, String(fallback));
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer.`);
  }

  return value;
}

function readAppEnv(): AppEnv {
  const value = readOptionalString("APP_ENV", "development");

  if (value === "development" || value === "test" || value === "production") {
    return value;
  }

  throw new Error("Environment variable APP_ENV must be development, test, or production.");
}

function readPublicBaseUrl(): string {
  const value = readOptionalString("PUBLIC_BASE_URL", `http://localhost:${readInteger("APP_PORT", 3000)}`);

  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error("Environment variable PUBLIC_BASE_URL must be a valid URL.");
  }
}

function resolveRuntimePath(fileName: string): string {
  const runtimeDir = readOptionalString("STORAGE_RUNTIME_DIR", "storage/runtime");
  const absoluteRuntimeDir = path.isAbsolute(runtimeDir) ? runtimeDir : path.resolve(workspaceRoot, runtimeDir);

  mkdirSync(absoluteRuntimeDir, { recursive: true });

  return path.join(absoluteRuntimeDir, fileName);
}

function readRuntimeSecret(envName: string, fileName: string): string {
  const configuredValue = process.env[envName];

  if (configuredValue && configuredValue.trim()) {
    return configuredValue.trim();
  }

  const secretPath = resolveRuntimePath(fileName);

  if (existsSync(secretPath)) {
    const value = readFileSync(secretPath, "utf8").trim();

    if (value) {
      return value;
    }
  }

  const secret = randomBytes(32).toString("hex");
  writeFileSync(secretPath, `${secret}\n`, { encoding: "utf8", flag: "w" });

  return secret;
}

const appPort = readInteger("APP_PORT", 3000);

export const env: ServerEnv = {
  appEnv: readAppEnv(),
  appHost: readOptionalString("APP_HOST", "127.0.0.1"),
  appPort,
  database: {
    host: readOptionalString("DATABASE_HOST", "127.0.0.1"),
    port: readInteger("DATABASE_PORT", 3306),
    name: readOptionalString("DATABASE_NAME", "liax_space"),
    user: readOptionalString("DATABASE_USER", "root"),
    password: readOptionalString("DATABASE_PASSWORD", "root")
  },
  jwtSecret: readRuntimeSecret("JWT_SECRET", "jwt-secret"),
  passwordPepper: readRuntimeSecret("PASSWORD_PEPPER", "password-pepper"),
  storage: {
    uploadsDir: readOptionalString("STORAGE_UPLOADS_DIR", "storage/uploads"),
    renderedDir: readOptionalString("STORAGE_RENDERED_DIR", "storage/rendered"),
    runtimeDir: readOptionalString("STORAGE_RUNTIME_DIR", "storage/runtime")
  },
  publicBaseUrl: readPublicBaseUrl()
};
