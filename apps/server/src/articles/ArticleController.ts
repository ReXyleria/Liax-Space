import type { Request, Response } from "express";

import { AuditLogService } from "../audit/AuditLogService.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { ArticleService } from "./ArticleService.js";

function requireAuthUserId(request: Request): number {
  if (!request.auth) {
    throw new AppError("Authentication required.", {
      code: errorCodes.unauthorized,
      statusCode: 401
    });
  }

  return request.auth.userId;
}

function readBodyRecord(request: Request): Record<string, unknown> {
  return request.body && typeof request.body === "object" ? (request.body as Record<string, unknown>) : {};
}

function readArticleId(request: Request): number {
  return Number(request.params.articleId);
}

function readLocale(request: Request): string {
  return request.params.locale;
}

export class ArticleController {
  constructor(
    private readonly articleService = new ArticleService(),
    private readonly auditLogService = new AuditLogService()
  ) {}

  createArticle = async (request: Request, response: Response): Promise<void> => {
    const userId = requireAuthUserId(request);
    const article = await this.articleService.createArticle(userId, readBodyRecord(request));

    await this.auditLogService.recordFromRequest({
      action: "article.created",
      entityId: article.id,
      entityType: "article",
      metadata: {
        coverAttachmentId: article.coverAttachmentId,
        status: article.status
      },
      request,
      userId
    });

    response.status(201).json({ article });
  };

  createTranslation = async (request: Request, response: Response): Promise<void> => {
    const userId = requireAuthUserId(request);
    const translation = await this.articleService.createTranslation(readArticleId(request), readBodyRecord(request));

    await this.auditLogService.recordFromRequest({
      action: "article.updated",
      entityId: translation.articleId,
      entityType: "article",
      metadata: {
        locale: translation.locale,
        translationId: translation.id,
        updateType: "create_translation"
      },
      request,
      userId
    });

    response.status(201).json({ translation });
  };

  listArticles = async (request: Request, response: Response): Promise<void> => {
    const articles = await this.articleService.listArticles(request.query);

    response.status(200).json({ articles });
  };

  getArticle = async (request: Request, response: Response): Promise<void> => {
    const article = await this.articleService.getArticle(readArticleId(request));

    response.status(200).json(article);
  };

  updateArticle = async (request: Request, response: Response): Promise<void> => {
    const userId = requireAuthUserId(request);
    const article = await this.articleService.updateArticle(readArticleId(request), readBodyRecord(request));

    await this.auditLogService.recordFromRequest({
      action: "article.updated",
      entityId: article.id,
      entityType: "article",
      metadata: {
        coverAttachmentId: article.coverAttachmentId,
        status: article.status,
        updateType: "update_article_config"
      },
      request,
      userId
    });

    response.status(200).json({ article });
  };

  updateTranslation = async (request: Request, response: Response): Promise<void> => {
    const userId = requireAuthUserId(request);
    const translation = await this.articleService.updateTranslation(
      readArticleId(request),
      readLocale(request),
      readBodyRecord(request)
    );

    await this.auditLogService.recordFromRequest({
      action: "article.updated",
      entityId: translation.articleId,
      entityType: "article",
      metadata: {
        locale: translation.locale,
        translationId: translation.id,
        updateType: "update_translation"
      },
      request,
      userId
    });

    response.status(200).json({ translation });
  };

  deleteArticle = async (request: Request, response: Response): Promise<void> => {
    const userId = requireAuthUserId(request);
    const article = await this.articleService.softDeleteArticle(readArticleId(request));

    await this.auditLogService.recordFromRequest({
      action: "article.deleted",
      entityId: article.id,
      entityType: "article",
      metadata: {
        deletedAt: article.deletedAt,
        status: article.status
      },
      request,
      userId
    });

    response.status(200).json({ article });
  };
}
