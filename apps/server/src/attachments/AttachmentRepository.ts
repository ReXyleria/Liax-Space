import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getDatabasePool } from "../database/connection.js";
import type { Attachment, AttachmentListInput, CreateAttachmentInput } from "./attachments.types.js";

type AttachmentRow = RowDataPacket & {
  id: number;
  owner_id: number;
  original_filename: string;
  storage_key: string;
  public_url: string | null;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  created_at: Date;
  deleted_at: Date | null;
};

const attachmentColumns = [
  "id",
  "owner_id",
  "original_filename",
  "storage_key",
  "public_url",
  "mime_type",
  "size_bytes",
  "sha256",
  "created_at",
  "deleted_at"
].join(", ");

function mapAttachmentRow(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    ownerId: row.owner_id,
    originalFilename: row.original_filename,
    storageKey: row.storage_key,
    publicUrl: row.public_url,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    createdAt: row.created_at,
    deletedAt: row.deleted_at
  };
}

export class AttachmentRepository {
  async listAttachments(input: AttachmentListInput = {}): Promise<Attachment[]> {
    const pool = getDatabasePool();
    const limit = Math.min(Math.max(Math.trunc(input.limit ?? 50), 1), 100);
    const offset = Math.max(Math.trunc(input.offset ?? 0), 0);
    const search = input.search?.trim();
    const params: string[] = [];
    const clauses = ["a.deleted_at IS NULL"];

    if (input.unusedOnly === true) {
      clauses.push("NOT EXISTS (SELECT 1 FROM article_version_attachments ava WHERE ava.attachment_id = a.id)");
    }

    if (search) {
      clauses.push("(a.original_filename LIKE ? OR a.storage_key LIKE ? OR a.sha256 LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.execute<AttachmentRow[]>(
      `SELECT ${attachmentColumns.split(", ").map((column) => `a.${column}`).join(", ")}
       FROM attachments a
       WHERE ${clauses.join(" AND ")}
       ORDER BY a.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return rows.map(mapAttachmentRow);
  }

  async createAttachment(input: CreateAttachmentInput): Promise<Attachment> {
    const pool = getDatabasePool();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO attachments
        (owner_id, original_filename, storage_key, public_url, mime_type, size_bytes, sha256)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.ownerId,
        input.originalFilename,
        input.storageKey,
        input.publicUrl ?? null,
        input.mimeType,
        input.sizeBytes,
        input.sha256
      ]
    );

    const attachment = await this.findById(result.insertId);

    if (!attachment) {
      throw new Error("Created attachment could not be loaded.");
    }

    return attachment;
  }

  async findById(id: number): Promise<Attachment | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<AttachmentRow[]>(
      `SELECT ${attachmentColumns} FROM attachments WHERE id = ? LIMIT 1`,
      [id]
    );

    return rows[0] ? mapAttachmentRow(rows[0]) : null;
  }

  async softDeleteMany(ids: number[], deletedAt = new Date()): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const pool = getDatabasePool();
    const placeholders = ids.map(() => "?").join(", ");
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE attachments
       SET deleted_at = ?
       WHERE id IN (${placeholders})
         AND deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1
           FROM article_version_attachments ava
           WHERE ava.attachment_id = attachments.id
         )`,
      [deletedAt, ...ids]
    );

    return result.affectedRows;
  }
}
