import type { RowDataPacket } from "mysql2/promise";

import type { ArticleTranslation } from "../articles/articles.types.js";
import { getDatabasePool } from "../database/connection.js";
import { MarkdownRenderer } from "../renderer/MarkdownRenderer.js";
import { SeoService } from "../seo/SeoService.js";
import { StaticPublisher } from "../publisher/StaticPublisher.js";
import { ArticleVersionRepository } from "../versions/ArticleVersionRepository.js";
import type { ArticleVersionLocale } from "../versions/versions.types.js";

export type RebuildHtmlJobInput = {
  dryRun?: boolean;
};

export type RebuildHtmlFailure = {
  articleId: number;
  locale: ArticleVersionLocale;
  publishedVersionId: number;
  reason: string;
};

export type RebuildHtmlJobResult = {
  dryRun: boolean;
  total: number;
  successCount: number;
  failureCount: number;
  failures: RebuildHtmlFailure[];
};

type PublishedTranslationRow = RowDataPacket & {
  id: number;
  article_id: number;
  locale: ArticleVersionLocale;
  title: string;
  slug: string;
  seo_title: string | null;
  seo_description: string | null;
  summary: string | null;
  current_version_id: number | null;
  published_version_id: number;
  current_html_path: string;
  created_at: Date;
  updated_at: Date;
  published_at: Date;
  allowed_roles_json: string | string[] | null;
};

const publishedTranslationColumns = [
  "article_translations.id",
  "article_translations.article_id",
  "article_translations.locale",
  "article_translations.title",
  "article_translations.slug",
  "article_translations.seo_title",
  "article_translations.seo_description",
  "article_translations.summary",
  "article_translations.current_version_id",
  "article_translations.published_version_id",
  "article_translations.current_html_path",
  "article_translations.created_at",
  "article_translations.updated_at",
  "article_translations.published_at",
  "article_translations.allowed_roles_json"
].join(", ");

function parseAllowedRoles(value: string | string[] | null): string[] {
  if (value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mapPublishedTranslationRow(row: PublishedTranslationRow): ArticleTranslation & {
  currentHtmlPath: string;
  publishedAt: Date;
  publishedVersionId: number;
} {
  return {
    allowedRoles: parseAllowedRoles(row.allowed_roles_json),
    articleId: row.article_id,
    createdAt: row.created_at,
    currentHtmlPath: row.current_html_path,
    currentVersionId: row.current_version_id,
    id: row.id,
    locale: row.locale,
    publishedAt: row.published_at,
    publishedVersionId: row.published_version_id,
    seoDescription: row.seo_description,
    seoTitle: row.seo_title,
    slug: row.slug,
    summary: row.summary,
    title: row.title,
    updatedAt: row.updated_at
  };
}

function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown rebuild failure.";
}

export class RebuildHtmlJob {
  constructor(
    private readonly versionRepository = new ArticleVersionRepository(),
    private readonly markdownRenderer = new MarkdownRenderer(),
    private readonly staticPublisher = new StaticPublisher(),
    private readonly seoService = new SeoService()
  ) {}

  async run(input: RebuildHtmlJobInput = {}): Promise<RebuildHtmlJobResult> {
    const dryRun = input.dryRun === true;
    const translations = await this.listPublishedTranslations();
    const failures: RebuildHtmlFailure[] = [];
    let successCount = 0;

    for (const translation of translations) {
      try {
        await this.rebuildOne(translation, dryRun);
        successCount += 1;
      } catch (error) {
        failures.push({
          articleId: translation.articleId,
          locale: translation.locale,
          publishedVersionId: translation.publishedVersionId,
          reason: errorReason(error)
        });
      }
    }

    return {
      dryRun,
      failureCount: failures.length,
      failures,
      successCount,
      total: translations.length
    };
  }

  private async rebuildOne(
    translation: ArticleTranslation & { currentHtmlPath: string; publishedAt: Date; publishedVersionId: number },
    dryRun: boolean
  ): Promise<void> {
    const version = await this.versionRepository.findById(translation.publishedVersionId);

    if (!version || version.articleId !== translation.articleId || version.locale !== translation.locale) {
      throw new Error("Published version could not be loaded for translation.");
    }

    const seoMeta = await this.seoService.buildArticleMetaFromTranslation(translation);
    const rendered = await this.markdownRenderer.render({
      alternates: seoMeta.alternates,
      canonicalUrl: seoMeta.canonicalUrl,
      contentHash: version.contentHash,
      description: seoMeta.description,
      locale: translation.locale,
      markdown: version.mdContent,
      title: seoMeta.title
    });

    if (dryRun) {
      return;
    }

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

    await this.versionRepository.updatePublishedRenderResult({
      customRuleVersion: rendered.customRuleVersion,
      htmlPath: publishedFile.htmlPath,
      rendererVersion: rendered.rendererVersion,
      renderHash: rendered.renderHash,
      templateVersion: rendered.templateVersion,
      versionId: version.id
    });
  }

  private async listPublishedTranslations(): Promise<Array<ArticleTranslation & {
    currentHtmlPath: string;
    publishedAt: Date;
    publishedVersionId: number;
  }>> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<PublishedTranslationRow[]>(
      `SELECT ${publishedTranslationColumns}
       FROM article_translations
       INNER JOIN articles ON articles.id = article_translations.article_id
       WHERE articles.deleted_at IS NULL
         AND article_translations.published_version_id IS NOT NULL
         AND article_translations.current_html_path IS NOT NULL
         AND article_translations.published_at IS NOT NULL
       ORDER BY article_translations.article_id ASC, article_translations.locale ASC`
    );

    return rows.map(mapPublishedTranslationRow);
  }
}
