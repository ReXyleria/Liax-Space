import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { cp, rename, rm, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { dirname, resolve } from "node:path";
import { finished } from "node:stream/promises";

import { atomicWriteFile } from "../common/fs/atomicWriteFile.js";
import { ensureDir } from "../common/fs/ensureDir.js";
import { env } from "../config/env.js";
import { storagePaths } from "../config/paths.js";

export type BackupJobInput = {
  backupRootDir?: string;
  now?: Date;
};

export type BackupManifest = {
  version: 1;
  createdAt: string;
  database: {
    tool: "mysqldump";
    host: string;
    port: number;
    name: string;
    dumpFile: string;
  };
  storage: {
    uploads: {
      included: true;
      path: string;
      source: string;
    };
    rendered: {
      included: false;
      reason: string;
    };
  };
};

export type BackupJobResult = {
  backupDir: string;
  manifestPath: string;
  mysqlDumpPath: string;
  uploadsBackupDir: string;
  renderedBackedUp: false;
};

const defaultBackupRootDir = resolve("storage", "backups");
const mysqlDumpFilename = "mysql.sql";
const uploadsBackupPath = "uploads";

function createBackupName(now: Date): string {
  return now.toISOString().replace(/[:.]/g, "-");
}

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

export class BackupJob {
  async run(input: BackupJobInput = {}): Promise<BackupJobResult> {
    const now = input.now ?? new Date();
    const backupRootDir = resolve(input.backupRootDir ?? defaultBackupRootDir);
    const backupDir = resolve(backupRootDir, createBackupName(now));
    const mysqlDumpPath = resolve(backupDir, mysqlDumpFilename);
    const uploadsBackupDir = resolve(backupDir, uploadsBackupPath);
    const manifestPath = resolve(backupDir, "manifest.json");

    await ensureDir(backupDir);
    await this.backupMysql(mysqlDumpPath);
    await this.backupUploads(uploadsBackupDir);
    await this.writeManifest(manifestPath, now);

    return {
      backupDir,
      manifestPath,
      mysqlDumpPath,
      renderedBackedUp: false,
      uploadsBackupDir
    };
  }

  private async backupMysql(mysqlDumpPath: string): Promise<void> {
    const credentialsPath = await this.writeMysqlDefaultsFile();
    const tempDumpPath = `${mysqlDumpPath}.${randomUUID()}.tmp`;

    try {
      await ensureDir(dirname(mysqlDumpPath));
      await this.runMysqlDump(credentialsPath, tempDumpPath);
      await rename(tempDumpPath, mysqlDumpPath);
    } catch (error) {
      await rm(tempDumpPath, { force: true });
      throw error;
    } finally {
      await rm(credentialsPath, { force: true });
    }
  }

  private async runMysqlDump(credentialsPath: string, outputPath: string): Promise<void> {
    const args = [
      `--defaults-extra-file=${credentialsPath}`,
      "--single-transaction",
      "--routines",
      "--triggers",
      "--default-character-set=utf8mb4",
      "--databases",
      env.database.name
    ];
    const child = spawn("mysqldump", args, { stdio: ["ignore", "pipe", "pipe"] });
    const readStderr = collectStderr(child);
    const output = createWriteStream(outputPath, { flags: "wx" });

    if (!child.stdout) {
      throw new Error("mysqldump stdout is not available.");
    }

    child.stdout.pipe(output);

    try {
      await Promise.all([
        waitForCommand(child, "mysqldump", readStderr),
        finished(output)
      ]);
    } catch (error) {
      output.destroy();
      throw error;
    }
  }

  private async backupUploads(uploadsBackupDir: string): Promise<void> {
    await ensureDir(dirname(uploadsBackupDir));

    try {
      await cp(storagePaths.uploadsDir, uploadsBackupDir, {
        force: true,
        recursive: true
      });
    } catch (error) {
      if (error !== null && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "ENOENT") {
        await ensureDir(uploadsBackupDir);
        return;
      }

      throw error;
    }
  }

  private async writeManifest(manifestPath: string, createdAt: Date): Promise<void> {
    const manifest: BackupManifest = {
      createdAt: createdAt.toISOString(),
      database: {
        dumpFile: mysqlDumpFilename,
        host: env.database.host,
        name: env.database.name,
        port: env.database.port,
        tool: "mysqldump"
      },
      storage: {
        rendered: {
          included: false,
          reason: "Rendered HTML is a derived artifact and should be rebuilt after restore."
        },
        uploads: {
          included: true,
          path: uploadsBackupPath,
          source: storagePaths.uploadsDir
        }
      },
      version: 1
    };

    await atomicWriteFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }

  private async writeMysqlDefaultsFile(): Promise<string> {
    await ensureDir(storagePaths.runtimeDir);

    const credentialsPath = resolve(storagePaths.runtimeDir, `mysql-backup-${randomUUID()}.cnf`);
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
