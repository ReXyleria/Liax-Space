import { constants } from "node:fs";
import { access, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { ensureDir } from "../common/fs/ensureDir.js";
import { generateRandomToken } from "../common/randomToken.js";
import { storagePaths } from "../config/index.js";
import { closeDatabasePool } from "../database/connection.js";
import { UserService } from "../users/UserService.js";
import { getSetupTokenPath } from "./SetupService.js";

type CreateSetupTokenOptions = {
  force?: boolean;
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function createSetupToken(options: CreateSetupTokenOptions = {}): Promise<string> {
  const existingAdmin = await new UserService().findAdminUser();

  if (existingAdmin) {
    throw new Error("Admin user already exists. Refusing to create a new setup token.");
  }

  await ensureDir(storagePaths.runtimeDir);

  const setupTokenPath = getSetupTokenPath();
  const tokenExists = await fileExists(setupTokenPath);

  if (tokenExists && !options.force) {
    throw new Error("Setup token already exists. Use --force only when you need to replace a lost unused token.");
  }

  const token = generateRandomToken(32);
  await writeFile(setupTokenPath, `${token}\n`, {
    encoding: "utf8",
    flag: options.force ? "w" : "wx",
    mode: 0o600
  });

  return token;
}

function parseOptions(args: string[]): CreateSetupTokenOptions {
  return {
    force: args.includes("--force")
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  createSetupToken(parseOptions(process.argv.slice(2)))
    .then((token) => {
      process.stdout.write(`Setup token created:\n${token}\n`);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to create setup token.";
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeDatabasePool();
    });
}
