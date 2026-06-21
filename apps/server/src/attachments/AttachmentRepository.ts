import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getDatabasePool } from "../database/connection.js";
import type { Attachment, AttachmentListInput, AttachmentReference, CreateAttachmentInput } from "./attachments.types.js";

type AttachmentRow = RowDataPacket & {
  id: number;
  owner_id: number;
  original_filename: string;
  storage_key: string;
  public_url: string | null;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  is_used?: number;
  created_at: Date;
  deleted_at: Date | null;
};

type AttachmentReferenceRow = RowDataPacket & {
  attachment_id: number;
  reference_type: AttachmentReference["type"];
  label: string;
  href: string | null;
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

const attachmentInUseWhere = `EXISTS (SELECT 1 FROM article_version_attachments ava WHERE ava.attachment_id = a.id)
        OR EXISTS (SELECT 1 FROM user_preferences up WHERE up.avatar_attachment_id = a.id)
        OR EXISTS (
          SELECT 1
          FROM site_settings ss
          WHERE ss.\`key\` = 'site.logoUrl'
            AND JSON_UNQUOTE(ss.value_json) = a.public_url
        )
        OR EXISTS (
          SELECT 1
          FROM moments m
          WHERE m.deleted_at IS NULL
            AND (
              (a.public_url IS NOT NULL AND JSON_CONTAINS(m.images_json, JSON_QUOTE(a.public_url)))
              OR JSON_CONTAINS(m.images_json, JSON_QUOTE(CONCAT('attachment://', a.id)))
            )
        )`;

function mapAttachmentRow(row: AttachmentRow, references: AttachmentReference[] = []): Attachment {
  return {
    id: row.id,
    ownerId: row.owner_id,
    originalFilename: row.original_filename,
    storageKey: row.storage_key,
    publicUrl: row.public_url,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    isUsed: row.is_used === undefined ? (references.length > 0 ? true : undefined) : row.is_used === 1 || references.length > 0,
    references,
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
      clauses.push(`NOT (${attachmentInUseWhere})`);
    }

    if (search) {
      clauses.push("(a.original_filename LIKE ? OR a.storage_key LIKE ? OR a.sha256 LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.execute<AttachmentRow[]>(
      `SELECT ${attachmentColumns.split(", ").map((column) => `a.${column}`).join(", ")},
              CASE WHEN (${attachmentInUseWhere}) THEN 1 ELSE 0 END AS is_used
       FROM attachments a
       WHERE ${clauses.join(" AND ")}
       ORDER BY a.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const referencesByAttachmentId = await this.listAttachmentReferences(rows.map((row) => row.id));

    return rows.map((row) => mapAttachmentRow(row, referencesByAttachmentId.get(row.id) ?? []));
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
         AND NOT (${attachmentInUseWhere.replace(/\ba\./gu, "attachments.")})`,
      [deletedAt, ...ids]
    );

    return result.affectedRows;
  }

  private async listAttachmentReferences(ids: number[]): Promise<Map<number, AttachmentReference[]>> {
    const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
    const referencesByAttachmentId = new Map<number, AttachmentReference[]>();

    if (uniqueIds.length === 0) {
      return referencesByAttachmentId;
    }

    const pool = getDatabasePool();
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const [rows] = await pool.execute<AttachmentReferenceRow[]>(
      `SELECT attachment_references.attachment_id,
              attachment_references.reference_type,
              attachment_references.label,
              attachment_references.href
       FROM (
         SELECT ava.attachment_id,
                'article' AS reference_type,
                CONCAT(COALESCE(NULLIF(at.title, ''), CONCAT('Article #', av.article_id)), ' - ', av.locale, ' v', av.version_no) AS label,
                CONCAT('#articles/', av.article_id, '/', av.locale, '/content') AS href,
                10 AS sort_order
         FROM article_version_attachments ava
         INNER JOIN article_versions av
           ON av.id = ava.article_version_id
         LEFT JOIN article_translations at
           ON at.article_id = av.article_id
          AND at.locale = av.locale
         WHERE ava.attachment_id IN (${placeholders})
         UNION ALL
         SELECT up.avatar_attachment_id AS attachment_id,
                'avatar' AS reference_type,
                COALESCE(NULLIF(u.username, ''), CONCAT('User #', up.user_id)) AS label,
                '#profile' AS href,
                20 AS sort_order
         FROM user_preferences up
         LEFT JOIN users u
           ON u.id = up.user_id
         WHERE up.avatar_attachment_id IN (${placeholders})
         UNION ALL
         SELECT a.id AS attachment_id,
                'siteLogo' AS reference_type,
                'site.logoUrl' AS label,
                '#settings' AS href,
                30 AS sort_order
         FROM attachments a
         INNER JOIN site_settings ss
           ON ss.\`key\` = 'site.logoUrl'
          AND JSON_UNQUOTE(ss.value_json) = a.public_url
         WHERE a.id IN (${placeholders})
           AND a.public_url IS NOT NULL
         UNION ALL
         SELECT a.id AS attachment_id,
                'moment' AS reference_type,
                CONCAT('Moment #', m.id, ' - ', m.locale) AS label,
                '#moments' AS href,
                40 AS sort_order
         FROM attachments a
         INNER JOIN moments m
           ON m.deleted_at IS NULL
          AND (
            (a.public_url IS NOT NULL AND JSON_CONTAINS(m.images_json, JSON_QUOTE(a.public_url)))
            OR JSON_CONTAINS(m.images_json, JSON_QUOTE(CONCAT('attachment://', a.id)))
          )
         WHERE a.id IN (${placeholders})
       ) attachment_references
       ORDER BY attachment_references.attachment_id,
                attachment_references.sort_order,
                attachment_references.label`,
      [...uniqueIds, ...uniqueIds, ...uniqueIds, ...uniqueIds]
    );

    for (const row of rows) {
      const references = referencesByAttachmentId.get(row.attachment_id) ?? [];
      references.push({
        href: row.href,
        label: row.label,
        type: row.reference_type
      });
      referencesByAttachmentId.set(row.attachment_id, references);
    }

    return referencesByAttachmentId;
  }
}
