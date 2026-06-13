import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { permissionRequired } from "../common/permissionRequired.js";
import { CategoryService } from "./CategoryService.js";

const categoryService = new CategoryService();

export const categoryRoutes = Router();

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

categoryRoutes.get(
  "/categories",
  authRequired,
  asyncHandler(async (_request, response) => {
    const categories = await categoryService.listCategories();

    response.status(200).json({ categories });
  })
);

categoryRoutes.post(
  "/categories",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    const category = await categoryService.createCategory(readBodyRecord(request.body));

    response.status(201).json({ category });
  })
);

categoryRoutes.patch(
  "/categories/:id/translations/:locale",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    const category = await categoryService.updateTranslation(
      readPositiveParam(request.params.id, "categoryId"),
      request.params.locale,
      readBodyRecord(request.body)
    );

    response.status(200).json({ category });
  })
);

categoryRoutes.delete(
  "/categories/:id",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    const category = await categoryService.deleteCategory(readPositiveParam(request.params.id, "categoryId"));

    response.status(200).json({ category });
  })
);

categoryRoutes.post(
  "/articles/:articleId/category",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(async (request, response) => {
    const result = await categoryService.setArticleCategory(
      readPositiveParam(request.params.articleId, "articleId"),
      readBodyRecord(request.body)
    );

    response.status(200).json(result);
  })
);
