import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { permissionRequired } from "../common/permissionRequired.js";
import { MomentService } from "./MomentService.js";
import type { MomentStatus } from "./moments.types.js";
import { isArticleLocale } from "../articles/articles.types.js";

const momentService = new MomentService();

export const momentRoutes = Router();

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

function readStatus(value: unknown): MomentStatus | undefined {
  return value === "draft" || value === "published" ? value : undefined;
}

momentRoutes.get(
  "/moments",
  authRequired,
  asyncHandler(async (request, response) => {
    const locale = isArticleLocale(request.query.locale) ? request.query.locale : undefined;
    const status = readStatus(request.query.status);
    const moments = await momentService.listMoments({
      limit: request.query.limit === undefined ? undefined : Number(request.query.limit),
      locale,
      offset: request.query.offset === undefined ? undefined : Number(request.query.offset),
      status
    });

    response.status(200).json({ moments });
  })
);

momentRoutes.post(
  "/moments",
  authRequired,
  permissionRequired("article:create"),
  asyncHandler(async (request, response) => {
    const moment = await momentService.createMoment(requireAuthUserId(request), readBodyRecord(request.body));

    response.status(201).json({ moment });
  })
);

momentRoutes.patch(
  "/moments/:id",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    const moment = await momentService.updateMoment(readPositiveParam(request.params.id, "momentId"), readBodyRecord(request.body));

    response.status(200).json({ moment });
  })
);

momentRoutes.post(
  "/moments/:id/publish",
  authRequired,
  permissionRequired("article:publish"),
  asyncHandler(async (request, response) => {
    const moment = await momentService.publishMoment(readPositiveParam(request.params.id, "momentId"));

    response.status(200).json({ moment });
  })
);

momentRoutes.post(
  "/moments/:id/unpublish",
  authRequired,
  permissionRequired("article:publish"),
  asyncHandler(async (request, response) => {
    const moment = await momentService.unpublishMoment(readPositiveParam(request.params.id, "momentId"));

    response.status(200).json({ moment });
  })
);

momentRoutes.delete(
  "/moments/:id",
  authRequired,
  permissionRequired("article:delete"),
  asyncHandler(async (request, response) => {
    const moment = await momentService.deleteMoment(readPositiveParam(request.params.id, "momentId"));

    response.status(200).json({ moment });
  })
);
