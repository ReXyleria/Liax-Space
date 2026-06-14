import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getDatabasePool } from "../database/connection.js";
import type {
  ArticleLocale,
  ArticleTranslation,
  CreateArticleTranslationInput,
  ListTranslationsInput,
  UpdateArticleTranslationInput,
  UpdateCurrentVersionInput,
  UpdatePublishedVersionInput
} from "./articles.types.js";

type ArticleTranslationRow = RowDataPacket & {
  id: number;
  article_id: number;
  locale: ArticleLocale;
  title: string;
  slug: string;
  seo_title: string | null;
  seo_description: string | null;
  summary: string | null;
  current_version_id: number | null;
  published_version_id: number | null;
  current_html_path: string | null;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  allowed_roles_json: string | string[] | null;
};

const translationColumns = [
  "id",
  "article_id",
  "locale",
  "title",
  "slug",
  "seo_title",
  "seo_description",
  "summary",
  "current_version_id",
  "published_version_id",
  "current_html_path",
  "created_at",
  "updated_at",
  "published_at",
  "allowed_roles_json"
].join(", ");

const prefixedTranslationColumns = translationColumns
  .split(", ")
  .map((column) => `article_translations.${column}`)
  .join(", ");

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

function mapArticleTranslationRow(row: ArticleTranslationRow): ArticleTranslation {
  return {
    id: row.id,
    articleId: row.article_id,
    locale: row.locale,
    title: row.title,
    slug: row.slug,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    summary: row.summary,
    currentVersionId: row.current_version_id,
    publishedVersionId: row.published_version_id,
    currentHtmlPath: row.current_html_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    allowedRoles: parseAllowedRoles(row.allowed_roles_json)
  };
}

export class ArticleTranslationRepository {
  async createTranslation(input: CreateArticleTranslationInput): Promise<ArticleTranslation> {
    const pool = getDatabasePool();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO article_translations
        (article_id, locale, title, slug, seo_title, seo_description, summary, allowed_roles_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.articleId,
        input.locale,
        input.title,
        input.slug,
        input.seoTitle ?? null,
        input.seoDescription ?? null,
        input.summary ?? null,
        JSON.stringify(input.allowedRoles ?? [])
      ]
    );

    const translation = await this.findById(result.insertId);

    if (!translation) {
      throw new Error("Created article translation could not be loaded.");
    }

    return translation;
  }

  async updateTranslation(input: UpdateArticleTranslationInput): Promise<ArticleTranslation | null> {
    const updates: string[] = [];
    const params: Array<string | number | null | Date> = [];

    if (input.title !== undefined) {
      updates.push("title = ?");
      params.push(input.title);
    }

    if (input.slug !== undefined) {
      updates.push("slug = ?");
      params.push(input.slug);
    }

    if (input.seoTitle !== undefined) {
      updates.push("seo_title = ?");
      params.push(input.seoTitle);
    }

    if (input.seoDescription !== undefined) {
      updates.push("seo_description = ?");
      params.push(input.seoDescription);
    }

    if (input.summary !== undefined) {
      updates.push("summary = ?");
      params.push(input.summary);
    }

    if (input.allowedRoles !== undefined) {
      updates.push("allowed_roles_json = ?");
      params.push(JSON.stringify(input.allowedRoles));
    }

    if (input.publishedAt !== undefined) {
      updates.push("published_at = ?");
      params.push(input.publishedAt);
    }

    if (updates.length === 0) {
      return this.findByArticleAndLocale(input.articleId, input.locale);
    }

    const pool = getDatabasePool();
    await pool.execute(
      `UPDATE article_translations SET ${updates.join(", ")} WHERE article_id = ? AND locale = ?`,
      [...params, input.articleId, input.locale]
    );

    return this.findByArticleAndLocale(input.articleId, input.locale);
  }

  async findByArticleAndLocale(articleId: number, locale: ArticleLocale): Promise<ArticleTranslation | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<ArticleTranslationRow[]>(
      `SELECT ${translationColumns} FROM article_translations WHERE article_id = ? AND locale = ? LIMIT 1`,
      [articleId, locale]
    );

    return rows[0] ? mapArticleTranslationRow(rows[0]) : null;
  }

  async findByLocaleAndSlug(locale: ArticleLocale, slug: string): Promise<ArticleTranslation | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<ArticleTranslationRow[]>(
      `SELECT ${translationColumns} FROM article_translations WHERE locale = ? AND slug = ? LIMIT 1`,
      [locale, slug]
    );

    return rows[0] ? mapArticleTranslationRow(rows[0]) : null;
  }

  async findPublicByLocaleAndSlug(locale: ArticleLocale, slug: string): Promise<ArticleTranslation | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<ArticleTranslationRow[]>(
      `SELECT ${prefixedTranslationColumns}
       FROM article_translations
       INNER JOIN articles ON articles.id = article_translations.article_id
       WHERE article_translations.locale = ?
         AND article_translations.slug = ?
         AND articles.deleted_at IS NULL
       LIMIT 1`,
      [locale, slug]
    );

    return rows[0] ? mapArticleTranslationRow(rows[0]) : null;
  }

  async updateCurrentVersion(input: UpdateCurrentVersionInput): Promise<ArticleTranslation | null> {
    const pool = getDatabasePool();
    await pool.execute(
      "UPDATE article_translations SET current_version_id = ? WHERE article_id = ? AND locale = ?",
      [input.currentVersionId, input.articleId, input.locale]
    );

    return this.findByArticleAndLocale(input.articleId, input.locale);
  }

  async updatePublishedVersion(input: UpdatePublishedVersionInput): Promise<ArticleTranslation | null> {
    const pool = getDatabasePool();
    await pool.execute(
      `UPDATE article_translations
       SET published_version_id = ?, current_html_path = ?, published_at = ?, allowed_roles_json = ?
       WHERE article_id = ? AND locale = ?`,
      [
        input.publishedVersionId,
        input.currentHtmlPath,
        input.publishedAt === undefined ? new Date() : input.publishedAt,
        JSON.stringify(input.allowedRoles ?? []),
        input.articleId,
        input.locale
      ]
    );

    return this.findByArticleAndLocale(input.articleId, input.locale);
  }

  async listTranslations(input: ListTranslationsInput = {}): Promise<ArticleTranslation[]> {
    const pool = getDatabasePool();
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (input.articleId !== undefined) {
      where.push("article_id = ?");
      params.push(input.articleId);
    }

    if (input.locale !== undefined) {
      where.push("locale = ?");
      params.push(input.locale);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const [rows] = await pool.execute<ArticleTranslationRow[]>(
      `SELECT ${translationColumns} FROM article_translations ${whereClause} ORDER BY article_id ASC, locale ASC`,
      params
    );

    return rows.map(mapArticleTranslationRow);
  }

  private async findById(id: number): Promise<ArticleTranslation | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<ArticleTranslationRow[]>(
      `SELECT ${translationColumns} FROM article_translations WHERE id = ? LIMIT 1`,
      [id]
    );

    return rows[0] ? mapArticleTranslationRow(rows[0]) : null;
  }
}
