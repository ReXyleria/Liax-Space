import type { Request, Response } from "express";

import { AuditLogService } from "../audit/AuditLogService.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { AttachmentService, maxAttachmentSizeBytes } from "./AttachmentService.js";
import { UserPreferencesService } from "../settings/UserPreferencesService.js";
import type { UploadedAttachmentFile } from "./attachments.types.js";

const multipartOverheadLimitBytes = 1024 * 1024;
const maxMultipartBodyBytes = maxAttachmentSizeBytes + multipartOverheadLimitBytes;

function validationError(message: string, statusCode = 400): AppError {
  return new AppError(message, {
    code: errorCodes.validationFailed,
    statusCode
  });
}

function requireAuthUserId(request: Request): number {
  if (!request.auth) {
    throw new AppError("Authentication required.", {
      code: errorCodes.unauthorized,
      statusCode: 401
    });
  }

  return request.auth.userId;
}

function readIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw validationError("ids must be an array.");
  }

  return value.map((id) => Number(id));
}

function parseBoundary(contentType: unknown): string {
  if (typeof contentType !== "string") {
    throw validationError("Content-Type must be multipart/form-data.");
  }

  const match = /multipart\/form-data;\s*boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = match?.[1] ?? match?.[2];

  if (!boundary) {
    throw validationError("multipart boundary is required.");
  }

  return boundary;
}

async function readRequestBody(request: Request): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;

    if (totalBytes > maxMultipartBodyBytes) {
      throw validationError("multipart body is too large.", 413);
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

function splitBuffer(buffer: Buffer, separator: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;
  let index = buffer.indexOf(separator, start);

  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + separator.length;
    index = buffer.indexOf(separator, start);
  }

  parts.push(buffer.subarray(start));

  return parts;
}

function trimPartBoundaryBytes(part: Buffer): Buffer {
  let start = 0;
  let end = part.length;

  if (end >= 2 && part.subarray(0, 2).toString("ascii") === "\r\n") {
    start = 2;
  }

  if (end >= 2 && part.subarray(end - 2, end).toString("ascii") === "\r\n") {
    end -= 2;
  }

  return part.subarray(start, end);
}

function parsePartHeaders(headerText: string): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const line of headerText.split("\r\n")) {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    headers[line.slice(0, separatorIndex).trim().toLowerCase()] = line.slice(separatorIndex + 1).trim();
  }

  return headers;
}

function parseHeaderParams(value: string): Record<string, string> {
  const params: Record<string, string> = {};

  for (const segment of value.split(";").slice(1)) {
    const [rawKey, ...rawValueParts] = segment.trim().split("=");
    const rawValue = rawValueParts.join("=");

    if (!rawKey || !rawValue) {
      continue;
    }

    params[rawKey.toLowerCase()] = rawValue.replace(/^"|"$/g, "");
  }

  return params;
}

function parseMultipartFile(body: Buffer, boundary: string): UploadedAttachmentFile {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const headerSeparator = Buffer.from("\r\n\r\n");
  const parts = splitBuffer(body, boundaryBuffer);

  for (const rawPart of parts) {
    const part = trimPartBoundaryBytes(rawPart);

    if (part.length === 0 || part.subarray(0, 2).toString("ascii") === "--") {
      continue;
    }

    const headerEnd = part.indexOf(headerSeparator);

    if (headerEnd === -1) {
      continue;
    }

    const headerText = part.subarray(0, headerEnd).toString("utf8");
    const headers = parsePartHeaders(headerText);
    const disposition = headers["content-disposition"];
    const contentType = headers["content-type"];

    if (!disposition || !contentType) {
      continue;
    }

    const params = parseHeaderParams(disposition);

    if (params.name !== "file" || !params.filename) {
      continue;
    }

    const fileBuffer = part.subarray(headerEnd + headerSeparator.length);

    return {
      buffer: fileBuffer,
      filename: params.filename,
      mimeType: contentType.toLowerCase(),
      sizeBytes: fileBuffer.length
    };
  }

  throw validationError('multipart field "file" is required.');
}

export class AttachmentController {
  constructor(
    private readonly attachmentService = new AttachmentService(),
    private readonly auditLogService = new AuditLogService(),
    private readonly userPreferencesService = new UserPreferencesService()
  ) {}

  uploadAttachment = async (request: Request, response: Response): Promise<void> => {
    const boundary = parseBoundary(request.headers["content-type"]);
    const body = await readRequestBody(request);
    const file = parseMultipartFile(body, boundary);
    const userId = requireAuthUserId(request);
    const result = await this.attachmentService.uploadAttachment(userId, file);

    await this.auditLogService.recordFromRequest({
      action: "attachment.uploaded",
      entityId: result.attachment.id,
      entityType: "attachment",
      metadata: {
        mimeType: result.attachment.mimeType,
        originalFilename: result.attachment.originalFilename,
        sizeBytes: result.attachment.sizeBytes
      },
      request,
      userId
    });

    response.status(201).json(result);
  };

  uploadAvatar = async (request: Request, response: Response): Promise<void> => {
    const boundary = parseBoundary(request.headers["content-type"]);
    const body = await readRequestBody(request);
    const file = parseMultipartFile(body, boundary);
    const userId = requireAuthUserId(request);
    const result = await this.attachmentService.uploadAttachment(userId, file);
    const preferences = await this.userPreferencesService.updatePreferences(userId, {
      avatarAttachmentId: result.attachment.id
    });

    await this.auditLogService.recordFromRequest({
      action: "profile.avatar_uploaded",
      entityId: result.attachment.id,
      entityType: "attachment",
      metadata: {
        mimeType: result.attachment.mimeType,
        originalFilename: result.attachment.originalFilename,
        sizeBytes: result.attachment.sizeBytes
      },
      request,
      userId
    });

    response.status(201).json({
      attachment: result.attachment,
      markdown: result.markdown,
      preferences: {
        avatar_attachment_id: preferences.avatarAttachmentId,
        avatar_public_url: preferences.avatarPublicUrl,
        locale: preferences.locale,
        reduced_motion: preferences.reducedMotion
      }
    });
  };

  listAttachments = async (request: Request, response: Response): Promise<void> => {
    requireAuthUserId(request);

    const attachments = await this.attachmentService.listAttachments({
      limit: request.query.limit === undefined ? undefined : Number(request.query.limit),
      offset: request.query.offset === undefined ? undefined : Number(request.query.offset),
      search: typeof request.query.search === "string" ? request.query.search : undefined,
      unusedOnly: request.query.unused === "1" || request.query.unused === "true"
    });

    response.status(200).json({ attachments });
  };

  deleteUnusedAttachments = async (request: Request, response: Response): Promise<void> => {
    const userId = requireAuthUserId(request);
    const ids = readIds(request.body?.ids);
    const result = await this.attachmentService.softDeleteUnusedAttachments(ids);

    await this.auditLogService.recordFromRequest({
      action: "attachment.unused_deleted",
      entityType: "attachment",
      metadata: { count: result.deleted },
      request,
      userId
    });

    response.status(200).json(result);
  };
}
