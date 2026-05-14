import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { ALLOWED_IMAGE_TYPES, UPLOAD_MAX_SIZE } from "@/lib/constants";
import { getUploadRoot } from "@/lib/runtime-paths";

const extensionByMime: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif"
};

export async function saveUploadedImage(file: File) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    throw new Error("Unsupported file type.");
  }

  if (file.size > UPLOAD_MAX_SIZE) {
    throw new Error("File is too large.");
  }

  const absoluteDir = getUploadRoot();
  await mkdir(absoluteDir, { recursive: true });

  const filename = `${randomUUID()}${extensionByMime[file.type]}`;
  const absolutePath = path.join(absoluteDir, filename);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, bytes);

  return {
    filename,
    url: `/uploads/${filename}`,
    mimeType: file.type,
    size: file.size
  };
}

export async function deleteUploadedFileByUrl(url: string) {
  if (!url.startsWith("/uploads/")) {
    return;
  }

  const filename = path.basename(url);
  const absolutePath = path.join(getUploadRoot(), filename);
  await unlink(absolutePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") {
      throw error;
    }
  });
}
