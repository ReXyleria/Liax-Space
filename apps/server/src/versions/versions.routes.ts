import { Router } from "express";

import { AuditLogService } from "../audit/AuditLogService.js";
import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { permissionRequired } from "../common/permissionRequired.js";
import { ArticleVersionService } from "./ArticleVersionService.js";

const articleVersionService = new ArticleVersionService();
const auditLogService = new AuditLogService();

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

    response.status(result.unchanged ? 200 : 201).json(result);
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
    const versions = await articleVersionService.listVersions(
      readPositiveParam(request.params.articleId, "articleId"),
      request.params.locale
    );

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
