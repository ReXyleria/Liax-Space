import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { permissionRequired } from "../common/permissionRequired.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { TranslationJobService } from "./TranslationJobService.js";

const translationJobService = new TranslationJobService();

export const translationRoutes = Router();

function readJobId(value: string): number {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("Translation job id must be a positive integer.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  return id;
}

translationRoutes.post(
  "/translate",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    response.status(202).json({
      job: await translationJobService.enqueueTranslate(request.body)
    });
  })
);

translationRoutes.post(
  "/seo/generate",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    response.status(202).json({
      job: await translationJobService.enqueueSeo(request.body)
    });
  })
);

translationRoutes.get(
  "/translation-jobs/:id",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    response.status(200).json({
      job: await translationJobService.getJob(readJobId(request.params.id))
    });
  })
);
