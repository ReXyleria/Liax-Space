import { Router } from "express";

import { AuditLogService } from "../audit/AuditLogService.js";
import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { permissionRequired } from "../common/permissionRequired.js";
import { ArticleVersionService, summarizeArticleVersion } from "./ArticleVersionService.js";

const articleVersionService = new ArticleVersionService();
const auditLogService = new AuditLogService();
const maxMarkdownImportSizeBytes = 20 * 1024 * 1024;
const maxMarkdownMultipartBodyBytes = maxMarkdownImportSizeBytes + 1024 * 1024;

export const versionRoutes = Router();

function requireAuthUserId(request: { auth?: { userId: number } }): number {
  if (!request.auth) {
    throw new AppError("Authentication required.", {
      code: errorCodes.unauthorized,
      statusCode: 401
    });
  }

  return request.auth.userId;
}

function readPositiveParam(value: string | undefined, fieldName: string): number {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(`${fieldName} must be a positive integer.`, {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  return id;
}

function readBodyRecord(body: unknown): Record<string, unknown> {
  return body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

function validationError(message: string, statusCode = 400): AppError {
  return new AppError(message, {
    code: errorCodes.validationFailed,
    statusCode
  });
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

async function readMultipartRequestBody(request: AsyncIterable<unknown>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    totalBytes += buffer.length;

    if (totalBytes > maxMarkdownMultipartBodyBytes) {
      throw validationError("Markdown import body is too large.", 413);
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

function isMarkdownFilename(filename: string): boolean {
  return /\.(md|markdown|mdown|txt)$/i.test(filename);
}

function parseMultipartMarkdownFile(body: Buffer, boundary: string): { filename: string; markdown: string; sizeBytes: number } {
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

    if (!disposition) {
      continue;
    }

    const params = parseHeaderParams(disposition);

    if (params.name !== "file" || !params.filename) {
      continue;
    }

    if (!isMarkdownFilename(params.filename)) {
      throw validationError("Markdown import file must use a .md, .markdown, .mdown, or .txt extension.");
    }

    const fileBuffer = part.subarray(headerEnd + headerSeparator.length);

    if (fileBuffer.length > maxMarkdownImportSizeBytes) {
      throw validationError("Markdown import file is too large.", 413);
    }

    return {
      filename: params.filename,
      markdown: fileBuffer.toString("utf8"),
      sizeBytes: fileBuffer.length
    };
  }

  throw validationError('multipart field "file" is required.');
}

versionRoutes.post(
  "/articles/:articleId/:locale/versions",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    const userId = requireAuthUserId(request);
    const result = await articleVersionService.saveVersion({
      articleId: readPositiveParam(request.params.articleId, "articleId"),
      locale: request.params.locale,
      baseVersionId: request.body?.baseVersionId,
      mdContent: request.body?.mdContent,
      createdBy: userId
    });

    await auditLogService.recordFromRequest({
      action: "article_version.saved",
      entityId: result.version.articleId,
      entityType: "article",
      metadata: {
        locale: result.version.locale,
        unchanged: result.unchanged,
        versionId: result.version.id,
        versionNo: result.version.versionNo
      },
      request,
      userId
    });

    response.status(result.unchanged ? 200 : 201).json({
      unchanged: result.unchanged,
      version: summarizeArticleVersion(result.version)
    });
  })
);

versionRoutes.post(
  "/articles/:articleId/:locale/versions/import",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    const userId = requireAuthUserId(request);
    const boundary = parseBoundary(request.headers["content-type"]);
    const body = await readMultipartRequestBody(request);
    const file = parseMultipartMarkdownFile(body, boundary);
    const result = await articleVersionService.importMarkdownVersion({
      articleId: readPositiveParam(request.params.articleId, "articleId"),
      createdBy: userId,
      locale: request.params.locale,
      mdContent: file.markdown
    });

    await auditLogService.recordFromRequest({
      action: "article_version.imported",
      entityId: result.version.articleId,
      entityType: "article",
      metadata: {
        filename: file.filename,
        locale: result.version.locale,
        sizeBytes: file.sizeBytes,
        unchanged: result.unchanged,
        versionId: result.version.id,
        versionNo: result.version.versionNo
      },
      request,
      userId
    });

    response.status(result.unchanged ? 200 : 201).json({
      unchanged: result.unchanged,
      version: summarizeArticleVersion(result.version)
    });
  })
);

versionRoutes.post(
  "/articles/:articleId/:locale/rollback",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    const body = readBodyRecord(request.body);
    const userId = requireAuthUserId(request);
    const result = await articleVersionService.rollbackVersion({
      articleId: readPositiveParam(request.params.articleId, "articleId"),
      locale: request.params.locale,
      targetVersionId: body.targetVersionId,
      createdBy: userId
    });

    await auditLogService.recordFromRequest({
      action: "article.rollback",
      entityId: result.version.articleId,
      entityType: "article",
      metadata: {
        locale: result.version.locale,
        newVersionId: result.version.id,
        targetVersionId: body.targetVersionId,
        versionNo: result.version.versionNo
      },
      request,
      userId
    });

    response.status(201).json(result);
  })
);

versionRoutes.get(
  "/articles/:articleId/:locale/versions",
  authRequired,
  asyncHandler(async (request, response) => {
    const articleId = readPositiveParam(request.params.articleId, "articleId");
    const versions = request.query.content === "summary"
      ? await articleVersionService.listVersionSummaries(articleId, request.params.locale)
      : await articleVersionService.listVersions(articleId, request.params.locale);

    response.status(200).json({ versions });
  })
);

versionRoutes.post(
  "/articles/:articleId/:locale/versions/:versionId/pin",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    const version = await articleVersionService.pinVersion(
      readPositiveParam(request.params.articleId, "articleId"),
      request.params.locale,
      readPositiveParam(request.params.versionId, "versionId")
    );

    response.status(200).json({ version });
  })
);

versionRoutes.post(
  "/articles/:articleId/:locale/versions/:versionId/unpin",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    const version = await articleVersionService.unpinVersion(
      readPositiveParam(request.params.articleId, "articleId"),
      request.params.locale,
      readPositiveParam(request.params.versionId, "versionId")
    );

    response.status(200).json({ version });
  })
);

versionRoutes.get(
  "/articles/:articleId/:locale/versions/:versionId/markdown",
  authRequired,
  asyncHandler(async (request, response) => {
    const version = await articleVersionService.getVersion(
      readPositiveParam(request.params.articleId, "articleId"),
      request.params.locale,
      readPositiveParam(request.params.versionId, "versionId")
    );

    response
      .status(200)
      .type("text/markdown; charset=utf-8")
      .setHeader("Cache-Control", "no-store")
      .send(version.mdContent);
  })
);

versionRoutes.get(
  "/articles/:articleId/:locale/versions/:versionId",
  authRequired,
  asyncHandler(async (request, response) => {
    const version = await articleVersionService.getVersion(
      readPositiveParam(request.params.articleId, "articleId"),
      request.params.locale,
      readPositiveParam(request.params.versionId, "versionId")
    );

    response.status(200).json({ version });
  })
);
