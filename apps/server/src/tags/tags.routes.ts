import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { permissionRequired } from "../common/permissionRequired.js";
import { TagService } from "./TagService.js";

const tagService = new TagService();

export const tagRoutes = Router();

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

tagRoutes.get(
  "/tags",
  authRequired,
  asyncHandler(async (_request, response) => {
    const tags = await tagService.listTags();

    response.status(200).json({ tags });
  })
);

tagRoutes.post(
  "/tags",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    const tag = await tagService.createTag(readBodyRecord(request.body));

    response.status(201).json({ tag });
  })
);

tagRoutes.patch(
  "/tags/:id/translations/:locale",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    const tag = await tagService.updateTranslation(
      readPositiveParam(request.params.id, "tagId"),
      request.params.locale,
      readBodyRecord(request.body)
    );

    response.status(200).json({ tag });
  })
);

tagRoutes.delete(
  "/tags/:id",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    const tag = await tagService.deleteTag(readPositiveParam(request.params.id, "tagId"));

    response.status(200).json({ tag });
  })
);

tagRoutes.post(
  "/articles/:articleId/tags",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    const result = await tagService.replaceArticleTags(
      readPositiveParam(request.params.articleId, "articleId"),
      readBodyRecord(request.body)
    );

    response.status(200).json(result);
  })
);
