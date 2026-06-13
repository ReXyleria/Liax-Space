import { randomUUID } from "node:crypto";

import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { ArticleRepository } from "./ArticleRepository.js";
import { ArticleTranslationRepository } from "./ArticleTranslationRepository.js";
import type {
  Article,
  ArticleLocale,
  ArticleTranslation,
  CreateArticleTranslationInput,
  ListArticlesInput,
  UpdateArticleInput,
  UpdateArticleTranslationInput
} from "./articles.types.js";
import { isArticleLocale } from "./articles.types.js";

export type ArticleDetail = {
  article: Article;
  translations: ArticleTranslation[];
};

type TranslationMetadataInput = {
  locale?: unknown;
  title?: unknown;
  slug?: unknown;
  seoTitle?: unknown;
  seoDescription?: unknown;
  summary?: unknown;
  publishedAt?: unknown;
};

function validationError(message: string): AppError {
  return new AppError(message, {
    code: errorCodes.validationFailed,
    statusCode: 400
  });
}

function notFoundError(message: string): AppError {
  return new AppError(message, {
    code: errorCodes.notFound,
    statusCode: 404
  });
}

function duplicateSlugError(): AppError {
  return new AppError("Slug already exists for this locale.", {
    code: errorCodes.validationFailed,
    statusCode: 400
  });
}

function assertPositiveId(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw validationError(`${fieldName} must be a positive integer.`);
  }
}

function parseOptionalPositiveId(value: unknown, fieldName: string): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw validationError(`${fieldName} must be a positive integer or null.`);
  }

  return value;
}

function parseOptionalString(value: unknown, fieldName: string): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw validationError(`${fieldName} must be a string or null.`);
  }

  return value.trim() || null;
}

function parseOptionalStatus(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw validationError("status must be a string.");
  }

  const status = value.trim();

  if (!status) {
    throw validationError("status cannot be empty.");
  }

  if (status.length > 32) {
    throw validationError("status must be 32 characters or fewer.");
  }

  return status;
}

function parseOptionalDateTime(value: unknown, fieldName: string): Date | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string") {
    throw validationError(`${fieldName} must be an ISO datetime string.`);
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw validationError(`${fieldName} must be a valid datetime.`);
  }

  return date;
}

function parseRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw validationError(`${fieldName} is required.`);
  }

  return value.trim();
}

function parseLocale(value: unknown): ArticleLocale {
  if (!isArticleLocale(value)) {
    throw validationError("locale must be zh-CN or en-US.");
  }

  return value;
}

function normalizeSlug(value: unknown): string {
  const slug = parseOptionalString(value, "slug");
  return slug ?? randomUUID();
}

function parseListInput(query: Record<string, unknown>): ListArticlesInput {
  const limit = query.limit === undefined ? undefined : Number(query.limit);
  const offset = query.offset === undefined ? undefined : Number(query.offset);

  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0 || limit > 100)) {
    throw validationError("limit must be an integer between 1 and 100.");
  }

  if (offset !== undefined && (!Number.isInteger(offset) || offset < 0)) {
    throw validationError("offset must be a non-negative integer.");
  }

  return {
    status: typeof query.status === "string" && query.status.trim() ? query.status.trim() : undefined,
    limit,
    offset
  };
}

export class ArticleService {
  constructor(
    private readonly articleRepository = new ArticleRepository(),
    private readonly translationRepository = new ArticleTranslationRepository()
  ) {}

  async createArticle(authorId: number, input: Record<string, unknown> = {}): Promise<Article> {
    assertPositiveId(authorId, "authorId");

    return this.articleRepository.createArticle({
      authorId,
      status: typeof input.status === "string" && input.status.trim() ? input.status.trim() : "draft",
      coverAttachmentId: parseOptionalPositiveId(input.coverAttachmentId, "coverAttachmentId") ?? null
    });
  }

  async listArticles(query: Record<string, unknown> = {}): Promise<ArticleDetail[]> {
    const articles = await this.articleRepository.listArticles(parseListInput(query));

    return Promise.all(articles.map((article) => this.toArticleDetail(article)));
  }

  async getArticle(articleId: number): Promise<ArticleDetail> {
    const article = await this.requireArticle(articleId);

    return this.toArticleDetail(article);
  }

  async updateArticle(articleId: number, input: Record<string, unknown>): Promise<Article> {
    await this.requireArticle(articleId);

    const updateInput: UpdateArticleInput = {
      id: articleId
    };

    if (input.status !== undefined) {
      updateInput.status = parseOptionalStatus(input.status);
    }

    if (input.coverAttachmentId !== undefined) {
      updateInput.coverAttachmentId = parseOptionalPositiveId(input.coverAttachmentId, "coverAttachmentId") ?? null;
    }

    const article = await this.articleRepository.updateArticle(updateInput);

    if (!article) {
      throw notFoundError("Article not found.");
    }

    return article;
  }

  async createTranslation(articleId: number, input: TranslationMetadataInput): Promise<ArticleTranslation> {
    await this.requireArticle(articleId);

    const locale = parseLocale(input.locale);
    const existingTranslation = await this.translationRepository.findByArticleAndLocale(articleId, locale);

    if (existingTranslation) {
      throw validationError("Translation already exists for this article and locale.");
    }

    const translationInput: CreateArticleTranslationInput = {
      articleId,
      locale,
      title: parseRequiredString(input.title, "title"),
      slug: normalizeSlug(input.slug),
      seoTitle: parseOptionalString(input.seoTitle, "seoTitle") ?? null,
      seoDescription: parseOptionalString(input.seoDescription, "seoDescription") ?? null,
      summary: parseOptionalString(input.summary, "summary") ?? null
    };

    await this.assertSlugAvailable(locale, translationInput.slug, articleId);

    return this.translationRepository.createTranslation(translationInput);
  }

  async updateTranslation(articleId: number, localeValue: unknown, input: TranslationMetadataInput): Promise<ArticleTranslation> {
    await this.requireArticle(articleId);

    const locale = parseLocale(localeValue);
    const existingTranslation = await this.translationRepository.findByArticleAndLocale(articleId, locale);

    if (!existingTranslation) {
      throw notFoundError("Article translation not found.");
    }

    const updateInput: UpdateArticleTranslationInput = {
      articleId,
      locale
    };

    if (input.title !== undefined) {
      updateInput.title = parseRequiredString(input.title, "title");
    }

    if (input.slug !== undefined) {
      updateInput.slug = normalizeSlug(input.slug);
      await this.assertSlugAvailable(locale, updateInput.slug, articleId);
    }

    if (input.seoTitle !== undefined) {
      updateInput.seoTitle = parseOptionalString(input.seoTitle, "seoTitle") ?? null;
    }

    if (input.seoDescription !== undefined) {
      updateInput.seoDescription = parseOptionalString(input.seoDescription, "seoDescription") ?? null;
    }

    if (input.summary !== undefined) {
      updateInput.summary = parseOptionalString(input.summary, "summary") ?? null;
    }

    if (input.publishedAt !== undefined) {
      if (existingTranslation.publishedVersionId === null) {
        throw validationError("publishedAt can only be updated after this translation is published.");
      }

      updateInput.publishedAt = parseOptionalDateTime(input.publishedAt, "publishedAt");
    }

    const updatedTranslation = await this.translationRepository.updateTranslation(updateInput);

    if (!updatedTranslation) {
      throw notFoundError("Article translation not found.");
    }

    return updatedTranslation;
  }

  async softDeleteArticle(articleId: number): Promise<Article> {
    await this.requireArticle(articleId);
    const deletedArticle = await this.articleRepository.softDeleteArticle(articleId);

    if (!deletedArticle) {
      throw notFoundError("Article not found.");
    }

    return deletedArticle;
  }

  private async requireArticle(articleId: number): Promise<Article> {
    assertPositiveId(articleId, "articleId");

    const article = await this.articleRepository.findById(articleId);

    if (!article) {
      throw notFoundError("Article not found.");
    }

    return article;
  }

  private async toArticleDetail(article: Article): Promise<ArticleDetail> {
    return {
      article,
      translations: await this.translationRepository.listTranslations({
        articleId: article.id
      })
    };
  }

  private async assertSlugAvailable(locale: ArticleLocale, slug: string, currentArticleId: number): Promise<void> {
    const existingTranslation = await this.translationRepository.findByLocaleAndSlug(locale, slug);

    if (existingTranslation && existingTranslation.articleId !== currentArticleId) {
      throw duplicateSlugError();
    }
  }
}
