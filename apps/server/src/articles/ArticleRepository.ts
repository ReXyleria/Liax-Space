import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getDatabasePool } from "../database/connection.js";
import type { Article, CreateArticleInput, ListArticlesInput, UpdateArticleInput } from "./articles.types.js";

type ArticleRow = RowDataPacket & {
  id: number;
  author_id: number;
  status: string;
  cover_attachment_id: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

const articleColumns = [
  "articles.id",
  "articles.author_id",
  "articles.status",
  "articles.cover_attachment_id",
  "articles.created_at",
  "articles.updated_at",
  "articles.deleted_at"
].join(", ");

function mapArticleRow(row: ArticleRow): Article {
  return {
    id: row.id,
    authorId: row.author_id,
    status: row.status,
    coverAttachmentId: row.cover_attachment_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  };
}

export class ArticleRepository {
  async createArticle(input: CreateArticleInput): Promise<Article> {
    const pool = getDatabasePool();
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO articles (author_id, status, cover_attachment_id) VALUES (?, ?, ?)",
      [input.authorId, input.status ?? "draft", input.coverAttachmentId ?? null]
    );

    const article = await this.findById(result.insertId);

    if (!article) {
      throw new Error("Created article could not be loaded.");
    }

    return article;
  }

  async findById(id: number, options: { includeDeleted?: boolean } = {}): Promise<Article | null> {
    const pool = getDatabasePool();
    const whereDeleted = options.includeDeleted ? "" : " AND deleted_at IS NULL";
    const [rows] = await pool.execute<ArticleRow[]>(
      `SELECT ${articleColumns} FROM articles WHERE id = ?${whereDeleted} LIMIT 1`,
      [id]
    );

    return rows[0] ? mapArticleRow(rows[0]) : null;
  }

  async listArticles(input: ListArticlesInput = {}): Promise<Article[]> {
    const pool = getDatabasePool();
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (input.status) {
      where.push("articles.status = ?");
      params.push(input.status);
    }

    if (!input.includeDeleted) {
      where.push("articles.deleted_at IS NULL");
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const limit = Number.isInteger(input.limit) && input.limit && input.limit > 0 ? input.limit : 50;
    const offset = Number.isInteger(input.offset) && input.offset && input.offset > 0 ? input.offset : 0;
    const [rows] = await pool.execute<ArticleRow[]>(
      `SELECT ${articleColumns}, MAX(article_translations.published_at) AS sort_published_at
       FROM articles
       LEFT JOIN article_translations ON article_translations.article_id = articles.id
       ${whereClause}
       GROUP BY ${articleColumns}
       ORDER BY sort_published_at IS NULL ASC,
                sort_published_at DESC,
                articles.updated_at DESC,
                articles.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return rows.map(mapArticleRow);
  }

  async updateArticle(input: UpdateArticleInput): Promise<Article | null> {
    const pool = getDatabasePool();
    const sets: string[] = [];
    const params: Array<string | number | null> = [];

    if (input.status !== undefined) {
      sets.push("status = ?");
      params.push(input.status);
    }

    if (input.coverAttachmentId !== undefined) {
      sets.push("cover_attachment_id = ?");
      params.push(input.coverAttachmentId);
    }

    if (sets.length === 0) {
      return this.findById(input.id);
    }

    params.push(input.id);
    await pool.execute(
      `UPDATE articles SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`,
      params
    );

    return this.findById(input.id);
  }

  async softDeleteArticle(id: number, deletedAt = new Date()): Promise<Article | null> {
    const pool = getDatabasePool();
    await pool.execute("UPDATE articles SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL", [deletedAt, id]);

    return this.findById(id, { includeDeleted: true });
  }
}
