import { extname } from "node:path";

import { sha256 } from "../common/sha256.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { AttachmentRepository } from "./AttachmentRepository.js";
import { StorageService } from "./StorageService.js";
import type {
  Attachment,
  AttachmentListInput,
  AttachmentMimeType,
  AttachmentUploadResult,
  UploadedAttachmentFile
} from "./attachments.types.js";

export const maxAttachmentSizeBytes = 5 * 1024 * 1024;

const allowedMimeTypes = new Set<AttachmentMimeType>(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const blockedOriginalExtensions = new Set([".svg", ".html", ".htm", ".js", ".mjs", ".cjs", ".exe"]);

function validationError(message: string, statusCode = 400): AppError {
  return new AppError(message, {
    code: errorCodes.validationFailed,
    statusCode
  });
}

function parseAttachmentMimeType(value: string): AttachmentMimeType {
  if (!allowedMimeTypes.has(value as AttachmentMimeType)) {
    throw validationError("file must be jpeg, png, webp, or gif.");
  }

  return value as AttachmentMimeType;
}

function assertPositiveUserId(value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw validationError("userId must be a positive integer.");
  }
}

function normalizeIds(ids: number[]): number[] {
  const uniqueIds = [...new Set(ids.map((id) => Number(id)))];

  for (const id of uniqueIds) {
    if (!Number.isInteger(id) || id <= 0) {
      throw validationError("attachment id must be a positive integer.");
    }
  }

  return uniqueIds;
}

function normalizeOriginalFilename(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "upload";
  }

  return trimmed.replace(/[\u0000-\u001F\u007F]/g, "").slice(0, 255) || "upload";
}

function assertOriginalExtensionAllowed(filename: string): void {
  const extension = extname(filename).toLowerCase();

  if (blockedOriginalExtensions.has(extension)) {
    throw validationError("file type is not allowed.");
  }
}

function hasAllowedFileSignature(mimeType: AttachmentMimeType, buffer: Buffer): boolean {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return buffer.length >= 6 && ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"));
}

function toPublicUploadUrl(storageKey: string): string {
  return `/${storageKey.replace(/\\/g, "/")}`;
}

export class AttachmentService {
  constructor(
    private readonly attachmentRepository = new AttachmentRepository(),
    private readonly storageService = new StorageService()
  ) {}

  async uploadAttachment(ownerId: number, file: UploadedAttachmentFile): Promise<AttachmentUploadResult> {
    assertPositiveUserId(ownerId);

    if (file.sizeBytes <= 0) {
      throw validationError("file is required.");
    }

    if (file.sizeBytes > maxAttachmentSizeBytes) {
      throw validationError("file is too large.", 413);
    }

    const originalFilename = normalizeOriginalFilename(file.filename);
    assertOriginalExtensionAllowed(originalFilename);

    const mimeType = parseAttachmentMimeType(file.mimeType);

    if (!hasAllowedFileSignature(mimeType, file.buffer)) {
      throw validationError("file content does not match the allowed image type.");
    }

    const fileHash = sha256(file.buffer);
    const storedFile = await this.storageService.writeAttachmentFile({
      content: file.buffer,
      mimeType,
      sha256: fileHash
    });
    const attachment = await this.attachmentRepository.createAttachment({
      mimeType,
      originalFilename,
      ownerId,
      publicUrl: toPublicUploadUrl(storedFile.storageKey),
      sha256: fileHash,
      sizeBytes: file.sizeBytes,
      storageKey: storedFile.storageKey
    });

    return {
      attachment,
      markdown: `attachment://${attachment.id}`
    };
  }

  async listAttachments(input: AttachmentListInput = {}): Promise<Attachment[]> {
    return this.attachmentRepository.listAttachments({
      limit: input.limit,
      offset: input.offset,
      search: input.search?.trim(),
      unusedOnly: input.unusedOnly
    });
  }

  async softDeleteUnusedAttachments(ids: number[]): Promise<{ deleted: number }> {
    const attachmentIds = normalizeIds(ids);
    const deleted = await this.attachmentRepository.softDeleteMany(attachmentIds);

    return { deleted };
  }
}
