import type { RowDataPacket } from "mysql2/promise";

import { getDatabasePool } from "../database/connection.js";

export type DashboardTotals = {
  articles: number;
  users: number;
  moments: number;
  guestbook: number;
  comments: number;
};

export type RecentPublishedArticle = {
  articleId: number;
  locale: string;
  title: string;
  slug: string;
  publishedAt: Date | null;
};

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
