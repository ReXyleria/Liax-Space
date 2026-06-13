import { ArticleRepository } from "../articles/ArticleRepository.js";
import { ArticleTranslationRepository } from "../articles/ArticleTranslationRepository.js";
import { isArticleLocale } from "../articles/articles.types.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { sha256 } from "../common/sha256.js";
import { AttachmentResolver } from "../renderer/AttachmentResolver.js";
import { ArticleVersionRepository } from "./ArticleVersionRepository.js";
import { normalizeMarkdown } from "./normalizeMarkdown.js";
import type { ArticleVersion, ArticleVersionLocale, ArticleVersionSummary } from "./versions.types.js";

export type SaveArticleVersionInput = {
  articleId: number;
  locale: unknown;
  baseVersionId: unknown;
  mdContent: unknown;
  createdBy: number;
};

export type SaveArticleVersionResult = {
  unchanged: boolean;
  version: ArticleVersion;
};

export type RollbackArticleVersionInput = {
  articleId: number;
  locale: unknown;
  targetVersionId: unknown;
  createdBy: number;
};

export type RollbackArticleVersionResult = {
  version: ArticleVersion;
};

export type ImportMarkdownVersionInput = {
  articleId: number;
  locale: unknown;
  mdContent: string;
  createdBy: number;
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

function versionConflictError(): AppError {
  return new AppError("Article version conflict.", {
    code: errorCodes.articleVersionConflict,
    statusCode: 409
  });
}

function assertPositiveId(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw validationError(`${fieldName} must be a positive integer.`);
  }
}

function parseLocale(value: unknown): ArticleVersionLocale {
  if (!isArticleLocale(value)) {
    throw validationError("locale must be zh-CN or en-US.");
  }

  return value;
}

function parseBaseVersionId(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw validationError("baseVersionId must be a positive integer or null.");
  }

  return value;
}

function parseMarkdown(value: unknown): string {
  if (typeof value !== "string") {
    throw validationError("mdContent is required.");
  }

  return value;
}

export function summarizeArticleVersion(version: ArticleVersion): ArticleVersionSummary {
  return {
    articleId: version.articleId,
    contentHash: version.contentHash,
    contentSizeBytes: Buffer.byteLength(version.mdContent, "utf8"),
    createdAt: version.createdAt,
    createdBy: version.createdBy,
    customRuleVersion: version.customRuleVersion,
    htmlPath: version.htmlPath,
    id: version.id,
    isPinned: version.isPinned,
    isPublishedSnapshot: version.isPublishedSnapshot,
    locale: version.locale,
    renderHash: version.renderHash,
    rendererVersion: version.rendererVersion,
    renderStatus: version.renderStatus,
    templateVersion: version.templateVersion,
    versionNo: version.versionNo
  };
}

function parsePositiveInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw validationError(`${fieldName} must be a positive integer.`);
  }

  return value;
}

export class ArticleVersionService {
  constructor(
    private readonly articleRepository = new ArticleRepository(),
    private readonly translationRepository = new ArticleTranslationRepository(),
    private readonly versionRepository = new ArticleVersionRepository(),
    private readonly attachmentResolver = new AttachmentResolver()
  ) {}

  async saveVersion(input: SaveArticleVersionInput): Promise<SaveArticleVersionResult> {
    assertPositiveId(input.articleId, "articleId");
    assertPositiveId(input.createdBy, "createdBy");

    const locale = parseLocale(input.locale);
    const baseVersionId = parseBaseVersionId(input.baseVersionId);
    const normalizedMarkdown = normalizeMarkdown(parseMarkdown(input.mdContent));
    const contentHash = sha256(normalizedMarkdown);

    await this.requireArticleAndTranslation(input.articleId, locale);

    const latestVersion = await this.versionRepository.findLatestByArticleAndLocale(input.articleId, locale);
    const expectedBaseVersionId = latestVersion ? latestVersion.id : null;

    if (expectedBaseVersionId !== baseVersionId) {
      throw versionConflictError();
    }

    const attachmentIds = await this.attachmentResolver.validateAttachmentReferences(normalizedMarkdown);

    if (latestVersion && latestVersion.contentHash === contentHash) {
      await this.versionRepository.replaceVersionAttachments({
        attachmentIds,
        versionId: latestVersion.id
      });

      return {
        unchanged: true,
        version: latestVersion
      };
    }

    const version = await this.versionRepository.createVersion({
      articleId: input.articleId,
      locale,
      versionNo: await this.versionRepository.getNextVersionNo(input.articleId, locale),
      mdContent: normalizedMarkdown,
      contentHash,
      renderStatus: "pending",
      createdBy: input.createdBy
    });

    await this.translationRepository.updateCurrentVersion({
      articleId: input.articleId,
      locale,
      currentVersionId: version.id
    });
    await this.versionRepository.replaceVersionAttachments({
      attachmentIds,
      versionId: version.id
    });

    return {
      unchanged: false,
      version
    };
  }

  async importMarkdownVersion(input: ImportMarkdownVersionInput): Promise<SaveArticleVersionResult> {
    assertPositiveId(input.articleId, "articleId");
    assertPositiveId(input.createdBy, "createdBy");

    const locale = parseLocale(input.locale);
    const latestVersion = await this.versionRepository.findLatestByArticleAndLocale(input.articleId, locale);

    return this.saveVersion({
      articleId: input.articleId,
      baseVersionId: latestVersion?.id ?? null,
      createdBy: input.createdBy,
      locale,
      mdContent: input.mdContent
    });
  }

  async listVersions(articleId: number, localeValue: unknown): Promise<ArticleVersion[]> {
    assertPositiveId(articleId, "articleId");

    const locale = parseLocale(localeValue);
    await this.requireArticleAndTranslation(articleId, locale);

    return this.versionRepository.listByArticleAndLocale(articleId, locale);
  }

  async listVersionSummaries(articleId: number, localeValue: unknown): Promise<ArticleVersionSummary[]> {
    assertPositiveId(articleId, "articleId");

    const locale = parseLocale(localeValue);
    await this.requireArticleAndTranslation(articleId, locale);

    return this.versionRepository.listSummariesByArticleAndLocale(articleId, locale);
  }

  async getVersion(articleId: number, localeValue: unknown, versionId: number): Promise<ArticleVersion> {
    assertPositiveId(articleId, "articleId");
    assertPositiveId(versionId, "versionId");

    const locale = parseLocale(localeValue);
    await this.requireArticleAndTranslation(articleId, locale);

    const version = await this.versionRepository.findById(versionId);

    if (!version || version.articleId !== articleId || version.locale !== locale) {
      throw notFoundError("Article version not found.");
    }

    return version;
  }

  async rollbackVersion(input: RollbackArticleVersionInput): Promise<RollbackArticleVersionResult> {
    assertPositiveId(input.articleId, "articleId");
    assertPositiveId(input.createdBy, "createdBy");

    const locale = parseLocale(input.locale);
    const targetVersionId = parsePositiveInteger(input.targetVersionId, "targetVersionId");

    await this.requireArticleAndTranslation(input.articleId, locale);

    const targetVersion = await this.requireVersion(input.articleId, locale, targetVersionId);
    const attachmentIds = await this.attachmentResolver.validateAttachmentReferences(targetVersion.mdContent);
    const version = await this.versionRepository.createVersion({
      articleId: input.articleId,
      locale,
      versionNo: await this.versionRepository.getNextVersionNo(input.articleId, locale),
      mdContent: targetVersion.mdContent,
      contentHash: targetVersion.contentHash,
      renderStatus: "pending",
      createdBy: input.createdBy
    });

    await this.translationRepository.updateCurrentVersion({
      articleId: input.articleId,
      locale,
      currentVersionId: version.id
    });
    await this.versionRepository.replaceVersionAttachments({
      attachmentIds,
      versionId: version.id
    });

    return { version };
  }

  async pinVersion(articleId: number, localeValue: unknown, versionId: number): Promise<ArticleVersion> {
    assertPositiveId(articleId, "articleId");
    assertPositiveId(versionId, "versionId");

    const locale = parseLocale(localeValue);
    await this.requireArticleAndTranslation(articleId, locale);
    await this.requireVersion(articleId, locale, versionId);

    const version = await this.versionRepository.pinVersion(versionId);

    if (!version) {
      throw notFoundError("Article version not found.");
    }

    return version;
  }

  async unpinVersion(articleId: number, localeValue: unknown, versionId: number): Promise<ArticleVersion> {
    assertPositiveId(articleId, "articleId");
    assertPositiveId(versionId, "versionId");

    const locale = parseLocale(localeValue);
    await this.requireArticleAndTranslation(articleId, locale);
    await this.requireVersion(articleId, locale, versionId);

    const version = await this.versionRepository.unpinVersion(versionId);

    if (!version) {
      throw notFoundError("Article version not found.");
    }

    return version;
  }

  private async requireArticleAndTranslation(articleId: number, locale: ArticleVersionLocale): Promise<void> {
    const article = await this.articleRepository.findById(articleId);

    if (!article) {
      throw notFoundError("Article not found.");
    }

    const translation = await this.translationRepository.findByArticleAndLocale(articleId, locale);

    if (!translation) {
      throw notFoundError("Article translation not found.");
    }
  }

  private async requireVersion(articleId: number, locale: ArticleVersionLocale, versionId: number): Promise<ArticleVersion> {
    const version = await this.versionRepository.findById(versionId);

    if (!version || version.articleId !== articleId || version.locale !== locale) {
      throw notFoundError("Article version not found.");
    }

    return version;
  }
}
