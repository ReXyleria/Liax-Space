import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { permissionRequired } from "../common/permissionRequired.js";
import type { MailLog, MailTemplate } from "./mail.types.js";
import { MailService } from "./MailService.js";

const mailService = new MailService();

export const mailRoutes = Router();

function readLimit(value: unknown): number {
  const limit = typeof value === "string" ? Number(value) : value;

  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return 50;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), 200);
}

function serializeTemplate(template: MailTemplate) {
  return {
    bodyText: template.bodyText,
    createdAt: template.createdAt.toISOString(),
    enabled: template.enabled,
    id: template.id,
    key: template.key,
    locale: template.locale,
    subject: template.subject,
    updatedAt: template.updatedAt.toISOString()
  };
}

function serializeLog(log: MailLog) {
  return {
    createdAt: log.createdAt.toISOString(),
    id: log.id,
    message: log.message,
    providerResponse: log.providerResponse,
    recipient: log.recipient,
    relatedId: log.relatedId,
    relatedType: log.relatedType,
    status: log.status,
    subject: log.subject,
    templateKey: log.templateKey
  };
}

function requireTemplateParams(params: Record<string, string | undefined>) {
  const key = params.key;
  const locale = params.locale;

  if (!key || !locale) {
    throw new AppError("Mail template key and locale are required.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  return { key, locale };
}

mailRoutes.get(
  "/mail/templates",
  authRequired,
  permissionRequired("system:maintain"),
  asyncHandler(async (_request, response) => {
    response.status(200).json({
      templates: (await mailService.listTemplates()).map(serializeTemplate)
    });
  })
);

mailRoutes.patch(
  "/mail/templates/:key/:locale",
  authRequired,
  permissionRequired("system:maintain"),
  asyncHandler(async (request, response) => {
    const params = requireTemplateParams(request.params);
    const template = await mailService.updateTemplate({
      bodyText: request.body?.bodyText,
      enabled: request.body?.enabled,
      key: params.key,
      locale: params.locale,
      subject: request.body?.subject
    });

    response.status(200).json({
      template: serializeTemplate(template)
    });
  })
);

mailRoutes.get(
  "/mail/logs",
  authRequired,
  permissionRequired("system:maintain"),
  asyncHandler(async (request, response) => {
    response.status(200).json({
      logs: (await mailService.listLogs({ limit: readLimit(request.query.limit) })).map(serializeLog)
    });
  })
);
