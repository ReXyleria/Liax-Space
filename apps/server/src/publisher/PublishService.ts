import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { ArticleTranslationRepository } from "../articles/ArticleTranslationRepository.js";
import { isArticleLocale, type ArticleLocale, type ArticleTranslation } from "../articles/articles.types.js";
import { MarkdownRenderer } from "../renderer/MarkdownRenderer.js";
import { ArticleVersionRepository } from "../versions/ArticleVersionRepository.js";
import type { ArticleVersion } from "../versions/versions.types.js";
import { SeoService } from "../seo/SeoService.js";
import { PermissionService } from "../permissions/PermissionService.js";
import { StaticPublisher } from "./StaticPublisher.js";

export type PublishArticleInput = {
  articleId: unknown;
  allowedRoles?: unknown;
  locale: unknown;
  publishedAt?: unknown;
  versionId: unknown;
};

export type PublishArticleResult = {
  version: ArticleVersion;
  translation: ArticleTranslation;
  htmlPath: string;
};

export type UnpublishArticleInput = {
  articleId: unknown;
  locale: unknown;
};

export type UnpublishArticleResult = {
  translation: ArticleTranslation;
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

function parsePositiveInteger(value: unknown, fieldName: string): number {
  const numberValue = typeof value === "string" ? Number(value) : value;

  if (typeof numberValue !== "number" || !Number.isInteger(numberValue) || numberValue <= 0) {
    throw validationError(`${fieldName} must be a positive integer.`);
  }

  return numberValue;
}

function parseLocale(value: unknown): ArticleLocale {
  if (!isArticleLocale(value)) {
    throw validationError("locale must be zh-CN or en-US.");
  }

  return value;
}

function parseAllowedRoles(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw validationError("allowedRoles must be an array.");
  }

  return [...new Set(value.map((role) => {
    if (typeof role !== "string" || role.trim().length === 0) {
      throw validationError("allowedRoles must contain role keys.");
    }

    return role.trim();
  }))];
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

export class PublishService {
  constructor(
    private readonly versionRepository = new ArticleVersionRepository(),
    private readonly translationRepository = new ArticleTranslationRepository(),
    private readonly markdownRenderer = new MarkdownRenderer(),
    private readonly staticPublisher = new StaticPublisher(),
    private readonly seoService = new SeoService(),
    private readonly permissionService = new PermissionService()
  ) {}

  async publishArticle(input: PublishArticleInput): Promise<PublishArticleResult> {
    const articleId = parsePositiveInteger(input.articleId, "articleId");
    const versionId = parsePositiveInteger(input.versionId, "versionId");
    const locale = parseLocale(input.locale);
    const publishedAt = parseOptionalDateTime(input.publishedAt, "publishedAt");
    const version = await this.requireVersion(articleId, locale, versionId);
    const translation = await this.requireTranslation(articleId, locale);
    const allowedRoles = await this.parseExistingAllowedRoles(input.allowedRoles, translation.allowedRoles);

    try {
      await this.versionRepository.updateRenderStatus({
        renderStatus: "rendering",
        versionId
      });

      const { htmlPath, version: publishedVersion } = await this.renderPublishedTranslation(translation, version, allowedRoles);
      const publishedTranslation = await this.translationRepository.updatePublishedVersion({
        articleId,
        currentHtmlPath: htmlPath,
        locale,
        allowedRoles,
        publishedAt,
        publishedVersionId: versionId
      });

      if (!publishedVersion || !publishedTranslation) {
        throw notFoundError("Published article state could not be loaded.");
      }

      await this.refreshPublishedSiblingHtml(articleId, locale);

      return {
        htmlPath,
        translation: publishedTranslation,
        version: publishedVersion
      };
    } catch (error) {
      await this.markRenderFailed(versionId);
      throw error;
    }
  }

  async unpublishArticle(input: UnpublishArticleInput): Promise<UnpublishArticleResult> {
    const articleId = parsePositiveInteger(input.articleId, "articleId");
    const locale = parseLocale(input.locale);
    const translation = await this.requireTranslation(articleId, locale);

    if (translation.publishedVersionId === null && translation.currentHtmlPath === null && translation.publishedAt === null) {
      return { translation };
    }

    const unpublishedTranslation = await this.translationRepository.updatePublishedVersion({
      allowedRoles: translation.allowedRoles,
      articleId,
      currentHtmlPath: null,
      locale,
      publishedAt: null,
      publishedVersionId: null
    });

    if (!unpublishedTranslation) {
      throw notFoundError("Unpublished article state could not be loaded.");
    }

    await this.refreshPublishedSiblingHtml(articleId, locale);

    return {
      translation: unpublishedTranslation
    };
  }

  private async requireVersion(articleId: number, locale: ArticleLocale, versionId: number): Promise<ArticleVersion> {
    const version = await this.versionRepository.findById(versionId);

    if (!version) {
      throw notFoundError("Article version not found.");
    }

    if (version.articleId !== articleId || version.locale !== locale) {
      throw validationError("versionId must belong to articleId and locale.");
    }

    return version;
  }

  private async parseExistingAllowedRoles(value: unknown, fallback: string[]): Promise<string[]> {
    const allowedRoles = value === undefined ? [...fallback] : parseAllowedRoles(value);

    for (const role of allowedRoles) {
      if (!(await this.permissionService.roleExists(role))) {
        throw validationError(`allowedRoles contains unknown role: ${role}`);
      }
    }

    return allowedRoles;
  }

  private async requireTranslation(articleId: number, locale: ArticleLocale): Promise<ArticleTranslation> {
    const translation = await this.translationRepository.findByArticleAndLocale(articleId, locale);

    if (!translation) {
      throw notFoundError("Article translation not found.");
    }

    return translation;
  }

  private async markRenderFailed(versionId: number): Promise<void> {
    try {
      await this.versionRepository.updateRenderStatus({
        renderStatus: "failed",
        versionId
      });
    } catch {
      // Preserve the original publish failure for the caller.
    }
  }

  private async renderPublishedTranslation(
    translation: ArticleTranslation,
    version: ArticleVersion,
    allowedRoles = translation.allowedRoles
  ): Promise<{ htmlPath: string; version: ArticleVersion }> {
    const seoMeta = await this.seoService.buildArticleMetaFromTranslation(translation);
    const rendered = await this.markdownRenderer.render({
      allowedRoles,
      alternates: seoMeta.alternates,
      canonicalUrl: seoMeta.canonicalUrl,
      contentHash: version.contentHash,
      description: seoMeta.description,
      locale: translation.locale,
      markdown: version.mdContent,
      title: seoMeta.title
    });

    await this.versionRepository.replaceVersionAttachments({
      attachmentIds: rendered.usedAttachments.map((attachment) => attachment.id),
      versionId: version.id
    });

    const publishedFile = await this.staticPublisher.publishArticleHtml({
      articleId: translation.articleId,
      html: rendered.html,
      locale: translation.locale,
      versionId: version.id
    });
    const publishedVersion = await this.versionRepository.updatePublishedRenderResult({
      customRuleVersion: rendered.customRuleVersion,
      htmlPath: publishedFile.htmlPath,
      rendererVersion: rendered.rendererVersion,
      renderHash: rendered.renderHash,
      templateVersion: rendered.templateVersion,
      versionId: version.id
    });

    if (!publishedVersion) {
      throw notFoundError("Published article version could not be loaded.");
    }

    return {
      htmlPath: publishedFile.htmlPath,
      version: publishedVersion
    };
  }

  private async refreshPublishedSiblingHtml(articleId: number, currentLocale: ArticleLocale): Promise<void> {
    const translations = await this.translationRepository.listTranslations({ articleId });
    const siblingTranslations = translations.filter((translation) => {
      return (
        translation.locale !== currentLocale &&
        translation.publishedVersionId !== null &&
        translation.currentHtmlPath !== null
      );
    });

    for (const translation of siblingTranslations) {
      const version = await this.versionRepository.findById(translation.publishedVersionId ?? 0);

      if (!version) {
        throw notFoundError("Published sibling article version could not be loaded.");
      }

      await this.renderPublishedTranslation(translation, version);
    }
  }
}
