import "server-only";

import { readdir, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import type { RuntimeDirectoryHealth } from "@/features/system-health/types";
import { errorMessage } from "@/features/system-health/utils";

export async function checkRuntimeDirectory(
  key: RuntimeDirectoryHealth["key"],
  directory: string
): Promise<RuntimeDirectoryHealth> {
  const resolved = path.resolve(directory);

  try {
    const info = await stat(resolved);
    if (!info.isDirectory()) {
      return {
        key,
        path: resolved,
        exists: true,
        writable: false,
        entries: null,
        status: "critical",
        error: "Path exists but is not a directory."
      };
    }

    const probe = path.join(
      resolved,
      `.health-check-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );
    let writable = true;
    let writeError: string | undefined;
    try {
      await writeFile(probe, "ok", { flag: "wx" });
      await unlink(probe).catch(() => undefined);
    } catch (error) {
      writable = false;
      writeError = errorMessage(error);
    }

    let entries: number | null = null;
    try {
      entries = (await readdir(resolved)).length;
    } catch {
      entries = null;
    }

    return {
      key,
      path: resolved,
      exists: true,
      writable,
      entries,
      status: writable ? "ok" : "critical",
      error: writeError
    };
  } catch (error) {
    return {
      key,
      path: resolved,
      exists: false,
      writable: false,
      entries: null,
      status: "critical",
      error: errorMessage(error)
    };
  }
}
