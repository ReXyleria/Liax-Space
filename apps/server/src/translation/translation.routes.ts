import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { permissionRequired } from "../common/permissionRequired.js";
import { TranslationService } from "./TranslationService.js";

const translationService = new TranslationService();

export const translationRoutes = Router();

translationRoutes.post(
  "/translate",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    response.status(200).json({
      translation: await translationService.translate(request.body)
    });
  })
);

translationRoutes.post(
  "/seo/generate",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    response.status(200).json({
      seo: await translationService.generateSeo(request.body)
    });
  })
);
