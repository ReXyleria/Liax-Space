import { Router } from "express";

import { AuditLogService } from "../audit/AuditLogService.js";
import { AppError } from "../common/AppError.js";
import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { errorCodes } from "../common/errorCodes.js";
import { permissionRequired } from "../common/permissionRequired.js";
import { PublishService } from "./PublishService.js";

const publishService = new PublishService();
const auditLogService = new AuditLogService();

export const publisherRoutes = Router();

function readBodyRecord(body: unknown): Record<string, unknown> {
  return body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

function requireAuthUserId(request: { auth?: { userId: number } }): number {
  if (!request.auth) {
    throw new AppError("Authentication required.", {
      code: errorCodes.unauthorized,
      statusCode: 401
    });
  }

  return request.auth.userId;
}

publisherRoutes.post(
  "/articles/:articleId/:locale/publish",
  authRequired,
  permissionRequired("article:publish"),
  asyncHandler(async (request, response) => {
    const body = readBodyRecord(request.body);
    const userId = requireAuthUserId(request);

    try {
      const result = await publishService.publishArticle({
        allowedRoles: body.allowedRoles,
        articleId: request.params.articleId,
        locale: request.params.locale,
        versionId: body.versionId
      });

      await auditLogService.recordFromRequest({
        action: "article.published",
        entityId: result.translation.articleId,
        entityType: "article",
        metadata: {
          htmlPath: result.htmlPath,
          allowedRoles: result.translation.allowedRoles,
          locale: result.translation.locale,
          versionId: result.version.id
        },
        request,
        userId
      });

      response.status(200).json(result);
    } catch (error) {
      await auditLogService.recordFromRequest({
        action: "article.render_failed",
        entityId: request.params.articleId,
        entityType: "article",
        metadata: {
          locale: request.params.locale,
          reason: error instanceof Error ? error.message : "Unknown render failure.",
          versionId: body.versionId
        },
        request,
        userId
      });

      throw error;
    }
  })
);
