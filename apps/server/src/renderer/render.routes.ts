import { Router } from "express";

import { AuditLogService } from "../audit/AuditLogService.js";
import { sha256 } from "../common/sha256.js";
import { AppError } from "../common/AppError.js";
import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { errorCodes } from "../common/errorCodes.js";
import { MarkdownRenderer } from "./MarkdownRenderer.js";

type PreviewLocale = "zh-CN" | "en-US";

const markdownRenderer = new MarkdownRenderer();
const auditLogService = new AuditLogService();

export const renderRoutes = Router();

function validationError(message: string): AppError {
  return new AppError(message, {
    code: errorCodes.validationFailed,
    statusCode: 400
  });
}

function readBodyRecord(body: unknown): Record<string, unknown> {
  return body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

function parseMarkdownContent(value: unknown): string {
  if (typeof value !== "string") {
    throw validationError("mdContent must be a string.");
  }

  return value;
}

function parseLocale(value: unknown): PreviewLocale {
  if (value !== "zh-CN" && value !== "en-US") {
    throw validationError("locale must be zh-CN or en-US.");
  }

  return value;
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

renderRoutes.post(
  "/render/preview",
  authRequired,
  asyncHandler(async (request, response) => {
    const body = readBodyRecord(request.body);
    const mdContent = parseMarkdownContent(body.mdContent);
    const locale = parseLocale(body.locale);
    const contentHash = sha256(mdContent);
    const userId = requireAuthUserId(request);

    try {
      const result = await markdownRenderer.render({
        contentHash,
        locale,
        markdown: mdContent
      });

      response.status(200).json({
        html: result.html
      });
    } catch (error) {
      await auditLogService.recordFromRequest({
        action: "article.render_failed",
        entityType: "renderer",
        metadata: {
          contentHash,
          locale,
          reason: error instanceof Error ? error.message : "Unknown render failure."
        },
        request,
        userId
      });

      throw error;
    }
  })
);
