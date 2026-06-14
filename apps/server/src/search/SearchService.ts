import type { RowDataPacket } from "mysql2/promise";

import type { ArticleLocale } from "../articles/articles.types.js";
import { isArticleLocale } from "../articles/articles.types.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { getDatabasePool } from "../database/connection.js";
import { PermissionService } from "../permissions/PermissionService.js";
import { localeToPublicPrefix, publicPrefixToLocale, type PublicLocalePrefix } from "../seo/SeoService.js";

export type SearchResult = {
  articleId: number;
  locale: ArticleLocale;
  title: string;
  slug: string;
  summary: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  articleStatus: string;
  publishStatus: "draft" | "published";
  publishedAt: Date | null;
  updatedAt: Date;
  url: string | null;
  visitCount: number;
};

export type PublicSearchInput = {
  localePrefix: unknown;
  keyword?: unknown;
  tag?: unknown;
  category?: unknown;
  limit?: unknown;
  offset?: unknown;
};

export type AdminSearchInput = {
  keyword?: unknown;
  status?: unknown;
  tag?: unknown;
  category?: unknown;
  locale?: unknown;
  limit?: unknown;
  offset?: unknown;
  role: string;
};

type SearchRow = RowDataPacket & {
  article_id: number;
  locale: ArticleLocale;
  title: string;
  slug: string;
  summary: string | null;
  seo_title: string | null;
  seo_description: string | null;
  article_status: string;
  published_at: Date | null;
  updated_at: Date;
  published_version_id: number | null;
  visit_count: number | string;
};

type SearchQuery = {
  keyword?: string;
  status?: string;
  tag?: string;
  category?: string;
  locale?: ArticleLocale;
  limit: number;
  offset: number;
};

const searchColumns = [
  "article_translations.article_id",
  "article_translations.locale",
  "article_translations.title",
  "article_translations.slug",
  "article_translations.summary",
  "article_translations.seo_title",
  "article_translations.seo_description",
  "articles.status AS article_status",
  "article_translations.published_at",
  "article_translations.updated_at",
  "article_translations.published_version_id",
  `(
    SELECT COUNT(*)
    FROM visit_events
    WHERE visit_events.path = CONCAT('/', CASE article_translations.locale WHEN 'zh-CN' THEN 'zh' ELSE 'en' END, '/posts/', article_translations.slug)
      OR visit_events.path LIKE CONCAT('/', CASE article_translations.locale WHEN 'zh-CN' THEN 'zh' ELSE 'en' END, '/posts/', article_translations.slug, '?%')
      OR visit_events.path = CONCAT('/', article_translations.locale, '/articles/', article_translations.slug)
      OR visit_events.path LIKE CONCAT('/', article_translations.locale, '/articles/', article_translations.slug, '?%')
  ) AS visit_count`
].join(", ");

const permissionService = new PermissionService();

function validationError(message: string): AppError {
  return new AppError(message, {
    code: errorCodes.validationFailed,
    statusCode: 400
  });
}

function parseLocalePrefix(value: unknown): ArticleLocale {
  if (value !== "zh" && value !== "en") {
    throw new AppError("Search locale not found.", {
      code: errorCodes.notFound,
      statusCode: 404
    });
  }

  return publicPrefixToLocale(value as PublicLocalePrefix);
}

function parseLocale(value: unknown): ArticleLocale | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (!isArticleLocale(value)) {
    throw validationError("locale must be zh-CN or en-US.");
  }

  return value;
}

function parseOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return parseOptionalString(value[0]);
  }

  if (typeof value !== "string") {
    throw validationError("Search filter must be a string.");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return 20;
  }

  const parsed = Number(Array.isArray(value) ? value[0] : value);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 100) {
    throw validationError("limit must be an integer between 1 and 100.");
  }

  return parsed;
}

function parseOffset(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const parsed = Number(Array.isArray(value) ? value[0] : value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw validationError("offset must be a non-negative integer.");
  }

  return parsed;
}

function parseSearchQuery(input: Omit<SearchQuery, "limit" | "offset"> & { limit?: unknown; offset?: unknown }): SearchQuery {
  return {
    category: input.category,
    keyword: input.keyword,
    limit: parseLimit(input.limit),
    locale: input.locale,
    offset: parseOffset(input.offset),
    status: input.status,
    tag: input.tag
  };
}

function isPublishedWhere(): string {
  return [
    "article_translations.published_version_id IS NOT NULL",
    "article_translations.current_html_path IS NOT NULL",
    "article_translations.published_at IS NOT NULL"
  ].join(" AND ");
}

function isPubliclyVisibleWhere(): string {
  return `(
    JSON_LENGTH(COALESCE(article_translations.allowed_roles_json, JSON_ARRAY())) = 0
    OR JSON_CONTAINS(COALESCE(article_translations.allowed_roles_json, JSON_ARRAY()), JSON_QUOTE('guest'))
  )`;
}

function normalizeLike(value: string): string {
  return `%${value}%`;
}

function numericFilter(value: string): number | null {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function mapRow(row: SearchRow): SearchResult {
  const publishStatus = row.published_version_id === null || row.published_at === null ? "draft" : "published";

  return {
    articleId: row.article_id,
    articleStatus: row.article_status,
    locale: row.locale,
    publishedAt: row.published_at,
    publishStatus,
    seoDescription: row.seo_description,
    seoTitle: row.seo_title,
    slug: row.slug,
    summary: row.summary,
    title: row.title,
    updatedAt: row.updated_at,
    url: publishStatus === "published" ? `/${localeToPublicPrefix(row.locale)}/posts/${encodeURIComponent(row.slug)}` : null,
    visitCount: Number(row.visit_count) || 0
  };
}

export class SearchService {
  async searchPublic(input: PublicSearchInput): Promise<SearchResult[]> {
    const query = parseSearchQuery({
      category: parseOptionalString(input.category),
      keyword: parseOptionalString(input.keyword),
      limit: input.limit,
      locale: parseLocalePrefix(input.localePrefix),
      offset: input.offset,
      tag: parseOptionalString(input.tag)
    });

    return this.search(query, { publicOnly: true, publishedOnly: true, versionJoin: "published" });
  }

  async searchAdmin(input: AdminSearchInput): Promise<SearchResult[]> {
    const canSearchDrafts = await permissionService.hasPermission(input.role, "article:update");
    const requestedStatus = parseOptionalString(input.status);
    const query = parseSearchQuery({
      category: parseOptionalString(input.category),
      keyword: parseOptionalString(input.keyword),
      limit: input.limit,
      locale: parseLocale(input.locale),
      offset: input.offset,
      status: requestedStatus,
      tag: parseOptionalString(input.tag)
    });

    if (!canSearchDrafts) {
      query.status = "published";
    }

    return this.search(query, {
      publicOnly: false,
      publishedOnly: !canSearchDrafts,
      versionJoin: canSearchDrafts ? "current" : "published"
    });
  }

  private async search(
    query: SearchQuery,
    options: { publicOnly: boolean; publishedOnly: boolean; versionJoin: "current" | "published" }
  ): Promise<SearchResult[]> {
    const pool = getDatabasePool();
    const where = ["articles.deleted_at IS NULL"];
    const params: Array<string | number> = [];
    const versionJoinColumn = options.versionJoin === "published" ? "published_version_id" : "current_version_id";

    if (query.locale !== undefined) {
      where.push("article_translations.locale = ?");
      params.push(query.locale);
    }

    if (options.publishedOnly) {
      where.push(isPublishedWhere());
    }

    if (options.publicOnly) {
      where.push(isPubliclyVisibleWhere());
    }

    if (query.status !== undefined) {
      if (query.status === "published") {
        where.push(isPublishedWhere());
      } else if (query.status === "draft") {
        where.push(`NOT (${isPublishedWhere()})`);
      } else {
        where.push("articles.status = ?");
        params.push(query.status);
      }
    }

    if (query.keyword !== undefined) {
      const keyword = normalizeLike(query.keyword);
      where.push(`(
        article_translations.title LIKE ?
        OR article_translations.slug LIKE ?
        OR article_translations.seo_title LIKE ?
        OR article_translations.seo_description LIKE ?
        OR article_translations.summary LIKE ?
        OR article_versions.md_content LIKE ?
      )`);
      params.push(keyword, keyword, keyword, keyword, keyword, keyword);
    }

    if (query.tag !== undefined) {
      const tagId = numericFilter(query.tag);
      const tagLocale = query.locale ?? "";
      const tagParams: Array<string | number> = [tagLocale, tagLocale, query.tag, query.tag];
      const idClause = tagId === null ? "" : " OR article_tags.tag_id = ?";

      if (tagId !== null) {
        tagParams.push(tagId);
      }

      where.push(`EXISTS (
        SELECT 1
        FROM article_tags
        LEFT JOIN tag_translations
          ON tag_translations.tag_id = article_tags.tag_id
          AND (? = '' OR tag_translations.locale = ?)
        WHERE article_tags.article_id = articles.id
          AND (tag_translations.slug = ? OR tag_translations.name = ?${idClause})
      )`);
      params.push(...tagParams);
    }

    if (query.category !== undefined) {
      const categoryId = numericFilter(query.category);
      const categoryLocale = query.locale ?? "";
      const categoryParams: Array<string | number> = [categoryLocale, categoryLocale, query.category, query.category];
      const idClause = categoryId === null ? "" : " OR article_categories.category_id = ?";

      if (categoryId !== null) {
        categoryParams.push(categoryId);
      }

      where.push(`EXISTS (
        SELECT 1
        FROM article_categories
        LEFT JOIN category_translations
          ON category_translations.category_id = article_categories.category_id
          AND (? = '' OR category_translations.locale = ?)
        WHERE article_categories.article_id = articles.id
          AND (category_translations.slug = ? OR category_translations.name = ?${idClause})
      )`);
      params.push(...categoryParams);
    }

    const limit = Number.isInteger(query.limit) && query.limit > 0 ? query.limit : 20;
    const offset = Number.isInteger(query.offset) && query.offset > 0 ? query.offset : 0;
    const [rows] = await pool.execute<SearchRow[]>(
      `SELECT ${searchColumns}
       FROM article_translations
       INNER JOIN articles ON articles.id = article_translations.article_id
       LEFT JOIN article_versions ON article_versions.id = article_translations.${versionJoinColumn}
       WHERE ${where.join(" AND ")}
       ORDER BY article_translations.published_at DESC, article_translations.updated_at DESC, article_translations.article_id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return rows.map(mapRow);
  }
}
