import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

function findDotEnvPath(filePath: string): string | null {
  if (isAbsolute(filePath)) {
    return existsSync(filePath) ? filePath : null;
  }

  let currentDirectory = process.cwd();

  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(currentDirectory, filePath);

    if (existsSync(candidate)) {
      return candidate;
    }

    const parentDirectory = dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      break;
    }

    currentDirectory = parentDirectory;
  }

  return null;
}

export function loadDotEnv(filePath = ".env"): void {
  const absolutePath = findDotEnvPath(filePath);

  if (!absolutePath) {
    return;
  }

  for (const line of readFileSync(absolutePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
