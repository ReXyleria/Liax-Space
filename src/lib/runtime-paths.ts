import path from "path";

export function resolveRuntimePath(targetPath: string) {
  return path.isAbsolute(targetPath) ? targetPath : path.join(process.cwd(), targetPath);
}

export function getStorageRoot() {
  return resolveRuntimePath(process.env.APP_STORAGE_DIR || "storage");
}

export function getUploadRoot() {
  return resolveRuntimePath(process.env.UPLOAD_DIR || "public/uploads");
}

export function getBackupRoot() {
  return resolveRuntimePath(process.env.BACKUP_DIR || path.join(getStorageRoot(), "backups"));
}
