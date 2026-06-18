import type { RowDataPacket } from "mysql2/promise";

import { readDetailedOperatingSystem } from "../analytics/loginDimensions.js";
import { getDatabasePool } from "../database/connection.js";

export type DashboardTotals = {
  articles: number;
  users: number;
  moments: number;
  guestbook: number;
  comments: number;
};

export type LoginTotals = {
  loginEvents: number;
  loginUsers: number;
};

export type LoginAuditEvent = {
  userId: number | null;
  country: string;
  operatingSystem: string;
  createdAt: Date;
};

export type RecentPublishedArticle = {
  articleId: number;
  locale: string;
  title: string;
  slug: string;
  publishedAt: Date | null;
};

function parseMetadata(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }

  return typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export class DashboardRepository {
  async getTotals(): Promise<DashboardTotals> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<Array<RowDataPacket & DashboardTotals>>(
      `SELECT
         (SELECT COUNT(*) FROM articles WHERE deleted_at IS NULL) AS articles,
         (SELECT COUNT(*) FROM users WHERE disabled_at IS NULL) AS users,
         (SELECT COUNT(*) FROM moments WHERE deleted_at IS NULL) AS moments,
         (SELECT COUNT(*) FROM guestbook_entries WHERE deleted_at IS NULL) AS guestbook,
         0 AS comments`
    );

    return {
      articles: rows[0]?.articles ?? 0,
      comments: rows[0]?.comments ?? 0,
      guestbook: rows[0]?.guestbook ?? 0,
      moments: rows[0]?.moments ?? 0,
      users: rows[0]?.users ?? 0
    };
  }

  async getLoginTotals(startDate: Date): Promise<LoginTotals> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<Array<RowDataPacket & LoginTotals>>(
      `SELECT
         COUNT(*) AS loginEvents,
         COUNT(DISTINCT user_id) AS loginUsers
       FROM audit_logs
       WHERE action = 'auth.login_success'
         AND created_at >= ?`,
      [startDate]
    );

    return {
      loginEvents: rows[0]?.loginEvents ?? 0,
      loginUsers: rows[0]?.loginUsers ?? 0
    };
  }

  async listLoginAuditEvents(startDate: Date, limit = 2000): Promise<LoginAuditEvent[]> {
    const pool = getDatabasePool();
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 5000);
    const [rows] = await pool.execute<Array<RowDataPacket & {
      user_id: number | null;
      user_agent: string | null;
      metadata_json: unknown;
      created_at: Date;
    }>>(
      `SELECT user_id, user_agent, metadata_json, created_at
       FROM audit_logs
       WHERE action = 'auth.login_success'
         AND created_at >= ?
       ORDER BY created_at DESC, id DESC
       LIMIT ${safeLimit}`,
      [startDate]
    );

    return rows.map((row) => {
      const metadata = parseMetadata(row.metadata_json);
      const operatingSystem = readMetadataString(metadata, "operatingSystem")
        ?? readMetadataString(metadata, "deviceOs")
        ?? readDetailedOperatingSystem(row.user_agent);

      return {
        country: readMetadataString(metadata, "country") ?? "Unknown",
        createdAt: row.created_at,
        operatingSystem,
        userId: row.user_id
      };
    });
  }

  async listRecentPublishedArticles(limit = 8): Promise<RecentPublishedArticle[]> {
    const pool = getDatabasePool();
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
    const [rows] = await pool.execute<Array<RowDataPacket & {
      article_id: number;
      locale: string;
      title: string;
      slug: string;
      published_at: Date | null;
    }>>(
      `SELECT article_translations.article_id, article_translations.locale, article_translations.title,
              article_translations.slug, article_translations.published_at
       FROM article_translations
       INNER JOIN articles ON articles.id = article_translations.article_id
       WHERE articles.deleted_at IS NULL
         AND article_translations.published_version_id IS NOT NULL
       ORDER BY COALESCE(article_translations.published_at, article_translations.updated_at) DESC,
                article_translations.id DESC
       LIMIT ${safeLimit}`
    );

    return rows.map((row) => ({
      articleId: row.article_id,
      locale: row.locale,
      publishedAt: row.published_at,
      slug: row.slug,
      title: row.title
    }));
  }

}
