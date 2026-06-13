import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getDatabasePool } from "../database/connection.js";
import type { CreateMomentInput, ListMomentsInput, Moment, MomentStatus, UpdateMomentInput } from "./moments.types.js";
import type { ArticleLocale } from "../articles/articles.types.js";

type MomentRow = RowDataPacket & {
  id: number;
  author_id: number | null;
  locale: ArticleLocale;
  content: string;
  status: MomentStatus;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  deleted_at: Date | null;
};

const momentColumns = [
  "id",
  "author_id",
  "locale",
  "content",
  "status",
  "created_at",
  "updated_at",
  "published_at",
  "deleted_at"
].join(", ");

function mapMomentRow(row: MomentRow): Moment {
  return {
    authorId: row.author_id,
    content: row.content,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    id: row.id,
    locale: row.locale,
    publishedAt: row.published_at,
    status: row.status,
    updatedAt: row.updated_at
  };
}

export class MomentRepository {
  async createMoment(input: CreateMomentInput): Promise<Moment> {
    const pool = getDatabasePool();
    const publishedAt = input.status === "published" ? new Date() : null;
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO moments (author_id, locale, content, status, published_at)
       VALUES (?, ?, ?, ?, ?)`,
      [input.authorId, input.locale, input.content, input.status ?? "draft", publishedAt]
    );
    const moment = await this.findById(result.insertId);

    if (!moment) {
      throw new Error("Created moment could not be loaded.");
    }

    return moment;
  }

  async findById(id: number): Promise<Moment | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<MomentRow[]>(`SELECT ${momentColumns} FROM moments WHERE id = ? LIMIT 1`, [id]);

    return rows[0] ? mapMomentRow(rows[0]) : null;
  }

  async listMoments(input: ListMomentsInput = {}): Promise<Moment[]> {
    const pool = getDatabasePool();
    const limit = Math.min(Math.max(Math.trunc(input.limit ?? 50), 1), 100);
    const offset = Math.max(Math.trunc(input.offset ?? 0), 0);
    const clauses = [];
    const params: Array<ArticleLocale | MomentStatus> = [];

    if (!input.includeDeleted) {
      clauses.push("deleted_at IS NULL");
    }

    if (input.locale) {
      clauses.push("locale = ?");
      params.push(input.locale);
    }

    if (input.status) {
      clauses.push("status = ?");
      params.push(input.status);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const [rows] = await pool.execute<MomentRow[]>(
      `SELECT ${momentColumns}
       FROM moments
       ${whereSql}
       ORDER BY COALESCE(published_at, created_at) DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return rows.map(mapMomentRow);
  }

  async updateMoment(input: UpdateMomentInput): Promise<Moment | null> {
    const assignments = [];
    const params: Array<ArticleLocale | MomentStatus | Date | null | number | string> = [];

    if (input.locale !== undefined) {
      assignments.push("locale = ?");
      params.push(input.locale);
    }

    if (input.content !== undefined) {
      assignments.push("content = ?");
      params.push(input.content);
    }

    if (input.status !== undefined) {
      assignments.push("status = ?");
      params.push(input.status);
    }

    if (input.publishedAt !== undefined) {
      assignments.push("published_at = ?");
      params.push(input.publishedAt);
    }

    if (assignments.length === 0) {
      return this.findById(input.id);
    }

    const pool = getDatabasePool();
    params.push(input.id);
    await pool.execute(
      `UPDATE moments SET ${assignments.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
      params
    );

    return this.findById(input.id);
  }

  async softDeleteMoment(id: number, deletedAt = new Date()): Promise<Moment | null> {
    const pool = getDatabasePool();
    await pool.execute("UPDATE moments SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL", [deletedAt, id]);

    return this.findById(id);
  }
}
