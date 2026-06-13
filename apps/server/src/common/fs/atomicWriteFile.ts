import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { rename, rm, writeFile } from "node:fs/promises";

import { ensureDir } from "./ensureDir.js";

type FileContent = string | Buffer;

export interface AtomicWriteFileOperations {
  writeFile(path: string, data: FileContent): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  rm(path: string, options: { force: true }): Promise<void>;
}

const defaultOperations: AtomicWriteFileOperations = {
  rename,
  rm,
  writeFile,
};

export async function atomicWriteFile(
  targetPath: string,
  data: FileContent,
  operations: AtomicWriteFileOperations = defaultOperations,
): Promise<void> {
  const absoluteTargetPath = resolve(targetPath);
  const tempPath = `${absoluteTargetPath}.${randomUUID()}.tmp`;

  await ensureDir(dirname(absoluteTargetPath));

  try {
    await operations.writeFile(tempPath, data);
    await operations.rename(tempPath, absoluteTargetPath);
  } catch (error) {
    try {
      await operations.rm(tempPath, { force: true });
    } catch {
      // Keep the original write or rename error as the failure reason.
    }

    throw error;
  }
}
