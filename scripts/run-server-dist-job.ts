import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadDotEnv } from "./load-env.ts";

const projectRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

export async function runServerDistJob(relativeEntryPath: string, args: string[]): Promise<void> {
  loadDotEnv();

  const entryPath = path.join(projectRoot, "apps", "server", "dist", relativeEntryPath);

  if (!existsSync(entryPath)) {
    throw new Error(`Compiled server job was not found: ${path.relative(projectRoot, entryPath)}. Run npm run build first.`);
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [entryPath, ...args], {
      env: process.env,
      shell: false,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code && code !== 0) {
        process.exitCode = code;
      }

      resolve();
    });
  });
}
