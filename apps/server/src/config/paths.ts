import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(configDir, "../../../..");

function resolveStoragePath(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(workspaceRoot, value);
}

export const storagePaths = {
  uploadsDir: resolveStoragePath(env.storage.uploadsDir),
  renderedDir: resolveStoragePath(env.storage.renderedDir),
  runtimeDir: resolveStoragePath(env.storage.runtimeDir)
};
