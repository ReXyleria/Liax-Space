import { ArticleRepository } from "../articles/ArticleRepository.js";
import type { ArticleLocale } from "../articles/articles.types.js";
import { isArticleLocale } from "../articles/articles.types.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { TagRepository } from "./TagRepository.js";
import type { TagDetail, TagTranslationInput } from "./TagRepository.js";

type TranslationInput = {
  locale?: unknown;
  name?: unknown;
  slug?: unknown;
};

type ArticleTagsResult = {
  articleId: number;
  tags: TagDetail[];
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

function assertPositiveId(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw validationError(`${fieldName} must be a positive integer.`);
  }
}

function parseLocale(value: unknown): ArticleLocale {
  if (!isArticleLocale(value)) {
    throw validationError("locale must be zh-CN or en-US.");
  }

  return value;
}

function parseRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw validationError(`${fieldName} is required.`);
  }

  return value.trim();
}

function parseTranslationInput(input: TranslationInput, localeValue?: unknown): Omit<TagTranslationInput, "tagId"> {
  return {
    locale: parseLocale(localeValue ?? input.locale),
    name: parseRequiredString(input.name, "name"),
    slug: parseRequiredString(input.slug, "slug")
  };
}

function parseTranslations(value: unknown): Array<Omit<TagTranslationInput, "tagId">> {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw validationError("translations must be an array.");
  }

  const seenLocales = new Set<ArticleLocale>();

  return value.map((item) => {
    if (item === null || typeof item !== "object") {
      throw validationError("translation must be an object.");
    }

    const translation = parseTranslationInput(item as TranslationInput);

    if (seenLocales.has(translation.locale)) {
      throw validationError("translations cannot contain duplicate locales.");
    }

    seenLocales.add(translation.locale);
    return translation;
  });
}

function parseTagIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw validationError("tagIds must be an array.");
  }

  const tagIds = value.map((item) => {
    if (typeof item !== "number" || !Number.isInteger(item) || item <= 0) {
      throw validationError("tagIds must contain positive integers.");
    }

    return item;
  });

  return [...new Set(tagIds)];
}

export class TagService {
  constructor(
    private readonly tagRepository = new TagRepository(),
    private readonly articleRepository = new ArticleRepository()
  ) {}

  async listTags(): Promise<TagDetail[]> {
    return this.tagRepository.listTags();
  }

  async createTag(input: Record<string, unknown>): Promise<TagDetail> {
    const translations = parseTranslations(input.translations);

    for (const translation of translations) {
      await this.assertSlugAvailable(translation.locale, translation.slug);
    }

    const tag = await this.tagRepository.createTag();

    for (const translation of translations) {
      await this.tagRepository.createTranslation({
        tagId: tag.id,
        ...translation
      });
    }

    return this.requireTagDetail(tag.id);
  }

  async updateTranslation(tagId: number, localeValue: unknown, input: Record<string, unknown>): Promise<TagDetail> {
    assertPositiveId(tagId, "tagId");
    await this.requireTag(tagId);

    const translation = parseTranslationInput(input, localeValue);
    await this.assertSlugAvailable(translation.locale, translation.slug, tagId);

    const existingTranslation = await this.tagRepository.findTranslationByTagAndLocale(tagId, translation.locale);

    if (existingTranslation) {
      await this.tagRepository.updateTranslation({
        tagId,
        ...translation
      });
    } else {
      await this.tagRepository.createTranslation({
        tagId,
        ...translation
      });
    }

    return this.requireTagDetail(tagId);
  }

  async deleteTag(tagId: number): Promise<TagDetail> {
    assertPositiveId(tagId, "tagId");
    const tag = await this.requireTagDetail(tagId);
    const deleted = await this.tagRepository.deleteTag(tagId);

    if (!deleted) {
      throw notFoundError("Tag not found.");
    }

    return tag;
  }

  async replaceArticleTags(articleId: number, input: Record<string, unknown>): Promise<ArticleTagsResult> {
    assertPositiveId(articleId, "articleId");
    await this.requireArticle(articleId);

    const tagIds = parseTagIds(input.tagIds);

    for (const tagId of tagIds) {
      await this.requireTag(tagId);
    }

    return {
      articleId,
      tags: await this.tagRepository.replaceArticleTags(articleId, tagIds)
    };
  }

  private async requireArticle(articleId: number): Promise<void> {
    const article = await this.articleRepository.findById(articleId);

    if (!article) {
      throw notFoundError("Article not found.");
    }
  }

  private async requireTag(tagId: number): Promise<void> {
    const tag = await this.tagRepository.findById(tagId);

    if (!tag) {
      throw notFoundError("Tag not found.");
    }
  }

  private async requireTagDetail(tagId: number): Promise<TagDetail> {
    const tag = await this.tagRepository.findDetailById(tagId);

    if (!tag) {
      throw notFoundError("Tag not found.");
    }

    return tag;
  }

  private async assertSlugAvailable(locale: ArticleLocale, slug: string, currentTagId?: number): Promise<void> {
    const existingTranslation = await this.tagRepository.findTranslationByLocaleAndSlug(locale, slug);

    if (existingTranslation && existingTranslation.tagId !== currentTagId) {
      throw validationError("Tag slug already exists for this locale.");
    }
  }
}
