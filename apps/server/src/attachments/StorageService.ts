import { isAbsolute, relative, resolve } from "node:path";

import { atomicWriteFile } from "../common/fs/atomicWriteFile.js";
import { storagePaths } from "../config/paths.js";
import type { AttachmentMimeType } from "./attachments.types.js";

const extensionByMimeType: Record<AttachmentMimeType, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export type StoredAttachmentFile = {
  absolutePath: string;
  storageKey: string;
};

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function assertSafeSha256(value: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error("Invalid attachment sha256.");
  }
}

function resolveInsideUploadsDir(...segments: string[]): string {
  const uploadRoot = resolve(storagePaths.uploadsDir);
  const absolutePath = resolve(uploadRoot, ...segments);
  const relativePath = relative(uploadRoot, absolutePath);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error("Attachment storage path is outside uploads directory.");
  }

  return absolutePath;
}

export class StorageService {
  async writeAttachmentFile(input: {
    content: Buffer;
    mimeType: AttachmentMimeType;
    sha256: string;
    now?: Date;
  }): Promise<StoredAttachmentFile> {
    assertSafeSha256(input.sha256);

    const now = input.now ?? new Date();
    const year = String(now.getUTCFullYear());
    const month = padDatePart(now.getUTCMonth() + 1);
    const day = padDatePart(now.getUTCDate());
    const extension = extensionByMimeType[input.mimeType];
    const filename = `${input.sha256}.${extension}`;
    const absolutePath = resolveInsideUploadsDir(year, month, day, filename);

    await atomicWriteFile(absolutePath, input.content);

    return {
      absolutePath,
      storageKey: `uploads/${year}/${month}/${day}/${filename}`
    };
  }
}
