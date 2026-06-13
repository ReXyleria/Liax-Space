import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { finished } from "node:stream/promises";

import { ensureDir } from "../common/fs/ensureDir.js";
import { env } from "../config/env.js";
import { storagePaths } from "../config/paths.js";
import type { BackupManifest } from "./BackupJob.js";

export type RestoreJobInput = {
  backupDir: string;
  confirmRestore: boolean;
};

export type RestoreJobResult = {
  backupDir: string;
  restoredMysql: true;
  restoredUploads: true;
  manifest: BackupManifest;
  nextStep: string;
};

function formatMysqlOptionFileValue(value: string): string {
  if (value.includes("\n") || value.includes("\r")) {
    throw new Error("MySQL option file values cannot contain new lines.");
  }

  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

function collectStderr(child: ReturnType<typeof spawn>): () => string {
  let stderr = "";

  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => {
    stderr += chunk;
  });

  return () => stderr.trim();
}

function waitForCommand(child: ReturnType<typeof spawn>, commandName: string, readStderr: () => string): Promise<void> {
  return new Promise((resolveCommand, rejectCommand) => {
    child.once("error", rejectCommand);
    child.once("close", (code) => {
      if (code === 0) {
        resolveCommand();
        return;
      }

      const stderr = readStderr();
      const suffix = stderr.length > 0 ? ` ${stderr}` : "";
      rejectCommand(new Error(`${commandName} exited with code ${code}.${suffix}`));
    });
  });
}

function resolveInsideRoot(rootDir: string, childPath: string): string | null {
  const absolutePath = resolve(rootDir, childPath.replace(/\\/g, "/"));
  const relativePath = relative(rootDir, absolutePath);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return null;
  }

  return absolutePath;
}

function assertManifest(value: unknown): BackupManifest {
  if (value === null || typeof value !== "object") {
    throw new Error("Backup manifest must be an object.");
  }

  const manifest = value as BackupManifest;

  if (manifest.version !== 1) {
    throw new Error("Unsupported backup manifest version.");
  }

  if (!manifest.database || manifest.database.tool !== "mysqldump" || typeof manifest.database.dumpFile !== "string") {
    throw new Error("Backup manifest database section is invalid.");
  }

  if (!manifest.storage?.uploads?.included || typeof manifest.storage.uploads.path !== "string") {
    throw new Error("Backup manifest uploads section is invalid.");
  }

  return manifest;
}

export class RestoreJob {
  async run(input: RestoreJobInput): Promise<RestoreJobResult> {
    if (!input.confirmRestore) {
      throw new Error("Restore requires explicit confirmation. Re-run with --confirm-restore after verifying the backup directory.");
    }

    const backupDir = resolve(input.backupDir);
    const manifest = await this.readManifest(backupDir);
    const mysqlDumpPath = this.resolveBackupPath(backupDir, manifest.database.dumpFile);
    const uploadsBackupDir = this.resolveBackupPath(backupDir, manifest.storage.uploads.path);

    await this.restoreMysql(mysqlDumpPath);
    await this.restoreUploads(uploadsBackupDir);

    return {
      backupDir,
      manifest,
      nextStep: "Run scripts/rebuild-html.ts after restore because storage/rendered is a derived artifact.",
      restoredMysql: true,
      restoredUploads: true
    };
  }

  private async readManifest(backupDir: string): Promise<BackupManifest> {
    const manifestPath = resolve(backupDir, "manifest.json");
    const rawManifest = await readFile(manifestPath, "utf8");
    return assertManifest(JSON.parse(rawManifest));
  }

  private resolveBackupPath(backupDir: string, childPath: string): string {
    const absolutePath = resolveInsideRoot(backupDir, childPath);

    if (absolutePath === null) {
      throw new Error(`Backup manifest path escapes backup directory: ${childPath}`);
    }

    return absolutePath;
  }

  private async restoreMysql(mysqlDumpPath: string): Promise<void> {
    const credentialsPath = await this.writeMysqlDefaultsFile();

    try {
      await this.runMysqlRestore(credentialsPath, mysqlDumpPath);
    } finally {
      await rm(credentialsPath, { force: true });
    }
  }

  private async runMysqlRestore(credentialsPath: string, mysqlDumpPath: string): Promise<void> {
    const child = spawn("mysql", [
      `--defaults-extra-file=${credentialsPath}`,
      "--default-character-set=utf8mb4"
    ], { stdio: ["pipe", "ignore", "pipe"] });
    const readStderr = collectStderr(child);
    const input = createReadStream(mysqlDumpPath);

    if (!child.stdin) {
      throw new Error("mysql stdin is not available.");
    }

    input.pipe(child.stdin);

    try {
      await Promise.all([
        waitForCommand(child, "mysql", readStderr),
        finished(input)
      ]);
    } catch (error) {
      child.stdin?.destroy();
      throw error;
    }
  }

  private async restoreUploads(uploadsBackupDir: string): Promise<void> {
    await ensureDir(storagePaths.uploadsDir);
    await cp(uploadsBackupDir, storagePaths.uploadsDir, {
      force: true,
      recursive: true
    });
  }

  private async writeMysqlDefaultsFile(): Promise<string> {
    await ensureDir(storagePaths.runtimeDir);

    const credentialsPath = resolve(storagePaths.runtimeDir, `mysql-restore-${randomUUID()}.cnf`);
    const content = [
      "[client]",
      `host=${formatMysqlOptionFileValue(env.database.host)}`,
      `port=${env.database.port}`,
      `user=${formatMysqlOptionFileValue(env.database.user)}`,
      `password=${formatMysqlOptionFileValue(env.database.password)}`,
      "protocol=tcp",
      ""
    ].join("\n");

    await writeFile(credentialsPath, content, { flag: "wx" });
    return credentialsPath;
  }
}
