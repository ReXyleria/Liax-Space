import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { permissionRequired } from "../common/permissionRequired.js";
import { ArticleController } from "./ArticleController.js";

const articleController = new ArticleController();

export const articleRoutes = Router();

articleRoutes.post("/articles", authRequired, permissionRequired("article:create"), asyncHandler(articleController.createArticle));
articleRoutes.post(
  "/articles/:articleId/translations",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(articleController.createTranslation)
);
articleRoutes.get("/articles", authRequired, asyncHandler(articleController.listArticles));
articleRoutes.get("/articles/:articleId", authRequired, asyncHandler(articleController.getArticle));
articleRoutes.patch(
  "/articles/:articleId",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(articleController.updateArticle)
);
articleRoutes.patch(
  "/articles/:articleId/translations/:locale",
  authRequired,
  permissionRequired("article:update"),
  asyncHandler(articleController.updateTranslation)
);
articleRoutes.delete(
  "/articles/:articleId",
  authRequired,
  permissionRequired("article:delete"),
  asyncHandler(articleController.deleteArticle)
);
