import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import type { ArticleLocale } from "../articles/articles.types.js";
import { getDatabasePool } from "../database/connection.js";
import type {
  CreateGuestbookEntryInput,
  GuestbookEntry,
  ListGuestbookEntriesInput,
  ListPublicGuestbookEntriesInput,
  UpdateGuestbookEntryInput
} from "./guestbook.types.js";

type GuestbookEntryRow = RowDataPacket & {
  id: number;
  locale: ArticleLocale;
  author_name: string;
  email: string | null;
  content: string;
  notify_only: number | boolean;
  is_public: number | boolean;
  created_at: Date;
  deleted_at: Date | null;
};

const guestbookEntryColumns = [
  "id",
  "locale",
  "author_name",
  "email",
  "content",
  "notify_only",
  "is_public",
  "created_at",
  "deleted_at"
].join(", ");

function mapGuestbookEntryRow(row: GuestbookEntryRow): GuestbookEntry {
  return {
    authorName: row.author_name,
    content: row.content,
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
    email: row.email,
    id: row.id,
    isPublic: Boolean(row.is_public),
    locale: row.locale,
    notifyOnly: Boolean(row.notify_only)
  };
}

export class GuestbookRepository {
  async createEntry(input: CreateGuestbookEntryInput): Promise<GuestbookEntry> {
    const pool = getDatabasePool();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO guestbook_entries (locale, author_name, email, content, notify_only, is_public)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [input.locale, input.authorName, input.email, input.content, input.notifyOnly ? 1 : 0, input.isPublic ? 1 : 0]
    );
    const entry = await this.findById(result.insertId);

    if (!entry) {
      throw new Error("Created guestbook entry could not be loaded.");
    }

    return entry;
  }

  async findById(id: number): Promise<GuestbookEntry | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<GuestbookEntryRow[]>(
      `SELECT ${guestbookEntryColumns} FROM guestbook_entries WHERE id = ? LIMIT 1`,
      [id]
    );

    return rows[0] ? mapGuestbookEntryRow(rows[0]) : null;
  }

  async listPublicEntries(input: ListPublicGuestbookEntriesInput): Promise<GuestbookEntry[]> {
    const pool = getDatabasePool();
    const limit = Math.min(Math.max(Math.trunc(input.limit ?? 50), 1), 100);
    const offset = Math.max(Math.trunc(input.offset ?? 0), 0);
    const [rows] = await pool.execute<GuestbookEntryRow[]>(
      `SELECT ${guestbookEntryColumns}
       FROM guestbook_entries
       WHERE locale = ? AND is_public = 1 AND notify_only = 0 AND deleted_at IS NULL
       ORDER BY created_at DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [input.locale]
    );

    return rows.map(mapGuestbookEntryRow);
  }

  async countEntries(): Promise<number> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<Array<RowDataPacket & { total: number }>>(
      "SELECT COUNT(*) AS total FROM guestbook_entries WHERE deleted_at IS NULL"
    );

    return rows[0]?.total ?? 0;
  }

  async listEntries(input: ListGuestbookEntriesInput = {}): Promise<GuestbookEntry[]> {
    const pool = getDatabasePool();
    const limit = Math.min(Math.max(Math.trunc(input.limit ?? 50), 1), 200);
    const offset = Math.max(Math.trunc(input.offset ?? 0), 0);
    const where = ["deleted_at IS NULL"];
    const params: Array<string | number> = [];

    if (input.locale) {
      where.push("locale = ?");
      params.push(input.locale);
    }

    if (input.status === "public") {
      where.push("is_public = 1");
      where.push("notify_only = 0");
    } else if (input.status === "private") {
      where.push("notify_only = 1");
    } else if (input.status === "hidden") {
      where.push("is_public = 0");
      where.push("notify_only = 0");
    }

    const [rows] = await pool.execute<GuestbookEntryRow[]>(
      `SELECT ${guestbookEntryColumns}
       FROM guestbook_entries
       WHERE ${where.join(" AND ")}
       ORDER BY created_at DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return rows.map(mapGuestbookEntryRow);
  }

  async updateEntry(input: UpdateGuestbookEntryInput): Promise<GuestbookEntry | null> {
    const updates: string[] = [];
    const params: number[] = [];

    if (input.isPublic !== undefined) {
      updates.push("is_public = ?");
      params.push(input.isPublic ? 1 : 0);
    }

    if (input.notifyOnly !== undefined) {
      updates.push("notify_only = ?");
      params.push(input.notifyOnly ? 1 : 0);
    }

    if (updates.length > 0) {
      const pool = getDatabasePool();
      await pool.execute(
        `UPDATE guestbook_entries SET ${updates.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
        [...params, input.id]
      );
    }

    return this.findById(input.id);
  }

  async softDeleteEntry(id: number, deletedAt = new Date()): Promise<GuestbookEntry | null> {
    const pool = getDatabasePool();
    await pool.execute(
      "UPDATE guestbook_entries SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL",
      [deletedAt, id]
    );

    return this.findById(id);
  }
}
