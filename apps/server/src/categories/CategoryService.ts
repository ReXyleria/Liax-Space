import { ArticleRepository } from "../articles/ArticleRepository.js";
import type { ArticleLocale } from "../articles/articles.types.js";
import { isArticleLocale } from "../articles/articles.types.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { CategoryRepository } from "./CategoryRepository.js";
import type { CategoryDetail, CategoryTranslationInput } from "./CategoryRepository.js";

type TranslationInput = {
  locale?: unknown;
  name?: unknown;
  slug?: unknown;
};

type ArticleCategoryResult = {
  articleId: number;
  category: CategoryDetail;
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

function parseOptionalPositiveId(value: unknown, fieldName: string): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw validationError(`${fieldName} must be a positive integer or null.`);
  }

  return value;
}

function parseRequiredPositiveId(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw validationError(`${fieldName} must be a positive integer.`);
  }

  return value;
}

function parseTranslationInput(input: TranslationInput, localeValue?: unknown): Omit<CategoryTranslationInput, "categoryId"> {
  return {
    locale: parseLocale(localeValue ?? input.locale),
    name: parseRequiredString(input.name, "name"),
    slug: parseRequiredString(input.slug, "slug")
  };
}

function parseTranslations(value: unknown): Array<Omit<CategoryTranslationInput, "categoryId">> {
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

export class CategoryService {
  constructor(
    private readonly categoryRepository = new CategoryRepository(),
    private readonly articleRepository = new ArticleRepository()
  ) {}

  async listCategories(): Promise<CategoryDetail[]> {
    return this.categoryRepository.listCategories();
  }

  async createCategory(input: Record<string, unknown>): Promise<CategoryDetail> {
    const parentId = parseOptionalPositiveId(input.parentId, "parentId");
    const translations = parseTranslations(input.translations);

    if (parentId !== null) {
      await this.requireCategory(parentId);
    }

    for (const translation of translations) {
      await this.assertSlugAvailable(translation.locale, translation.slug);
    }

    const category = await this.categoryRepository.createCategory(parentId);

    for (const translation of translations) {
      await this.categoryRepository.createTranslation({
        categoryId: category.id,
        ...translation
      });
    }

    return this.requireCategoryDetail(category.id);
  }

  async updateTranslation(categoryId: number, localeValue: unknown, input: Record<string, unknown>): Promise<CategoryDetail> {
    assertPositiveId(categoryId, "categoryId");
    await this.requireCategory(categoryId);

    const translation = parseTranslationInput(input, localeValue);
    await this.assertSlugAvailable(translation.locale, translation.slug, categoryId);

    const existingTranslation = await this.categoryRepository.findTranslationByCategoryAndLocale(
      categoryId,
      translation.locale
    );

    if (existingTranslation) {
      await this.categoryRepository.updateTranslation({
        categoryId,
        ...translation
      });
    } else {
      await this.categoryRepository.createTranslation({
        categoryId,
        ...translation
      });
    }

    return this.requireCategoryDetail(categoryId);
  }

  async deleteCategory(categoryId: number): Promise<CategoryDetail> {
    assertPositiveId(categoryId, "categoryId");
    const category = await this.requireCategoryDetail(categoryId);
    const deleted = await this.categoryRepository.deleteCategory(categoryId);

    if (!deleted) {
      throw notFoundError("Category not found.");
    }

    return category;
  }

  async setArticleCategory(articleId: number, input: Record<string, unknown>): Promise<ArticleCategoryResult> {
    assertPositiveId(articleId, "articleId");
    await this.requireArticle(articleId);

    const categoryId = parseRequiredPositiveId(input.categoryId, "categoryId");
    await this.requireCategory(categoryId);

    const category = await this.categoryRepository.setArticleCategory(articleId, categoryId);

    if (!category) {
      throw notFoundError("Category not found.");
    }

    return {
      articleId,
      category
    };
  }

  private async requireArticle(articleId: number): Promise<void> {
    const article = await this.articleRepository.findById(articleId);

    if (!article) {
      throw notFoundError("Article not found.");
    }
  }

  private async requireCategory(categoryId: number): Promise<void> {
    const category = await this.categoryRepository.findById(categoryId);

    if (!category) {
      throw notFoundError("Category not found.");
    }
  }

  private async requireCategoryDetail(categoryId: number): Promise<CategoryDetail> {
    const category = await this.categoryRepository.findDetailById(categoryId);

    if (!category) {
      throw notFoundError("Category not found.");
    }

    return category;
  }

  private async assertSlugAvailable(locale: ArticleLocale, slug: string, currentCategoryId?: number): Promise<void> {
    const existingTranslation = await this.categoryRepository.findTranslationByLocaleAndSlug(locale, slug);

    if (existingTranslation && existingTranslation.categoryId !== currentCategoryId) {
      throw validationError("Category slug already exists for this locale.");
    }
  }
}
