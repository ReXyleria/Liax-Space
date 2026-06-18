import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getDatabasePool } from "../database/connection.js";
import type {
  CreateMailLogInput,
  MailLog,
  MailLogStatus,
  MailTemplate,
  MailTemplateKey,
  UpsertMailTemplateInput
} from "./mail.types.js";

type MailTemplateRow = RowDataPacket & {
  id: number;
  key: MailTemplateKey;
  locale: MailTemplate["locale"];
  subject: string;
  body_text: string;
  enabled: number | boolean;
  created_at: Date;
  updated_at: Date;
};

type MailLogRow = RowDataPacket & {
  id: number;
  template_key: string;
  recipient: string;
  subject: string;
  status: MailLogStatus;
  message: string | null;
  provider_response: string | null;
  related_type: string | null;
  related_id: number | null;
  created_at: Date;
};

const mailTemplateColumns = [
  "id",
  "`key`",
  "locale",
  "subject",
  "body_text",
  "enabled",
  "created_at",
  "updated_at"
].join(", ");

const mailLogColumns = [
  "id",
  "template_key",
  "recipient",
  "subject",
  "status",
  "message",
  "provider_response",
  "related_type",
  "related_id",
  "created_at"
].join(", ");

function mapMailTemplateRow(row: MailTemplateRow): MailTemplate {
  return {
    bodyText: row.body_text,
    createdAt: row.created_at,
    enabled: Boolean(row.enabled),
    id: row.id,
    key: row.key,
    locale: row.locale,
    subject: row.subject,
    updatedAt: row.updated_at
  };
}

function mapMailLogRow(row: MailLogRow): MailLog {
  return {
    createdAt: row.created_at,
    id: row.id,
    message: row.message,
    providerResponse: row.provider_response,
    recipient: row.recipient,
    relatedId: row.related_id,
    relatedType: row.related_type,
    status: row.status,
    subject: row.subject,
    templateKey: row.template_key
  };
}

export class MailRepository {
  async listTemplates(): Promise<MailTemplate[]> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<MailTemplateRow[]>(
      `SELECT ${mailTemplateColumns}
       FROM mail_templates
       ORDER BY \`key\` ASC, locale ASC`
    );

    return rows.map(mapMailTemplateRow);
  }

  async findTemplate(key: MailTemplateKey, locale: MailTemplate["locale"]): Promise<MailTemplate | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<MailTemplateRow[]>(
      `SELECT ${mailTemplateColumns}
       FROM mail_templates
       WHERE \`key\` = ? AND locale = ?
       LIMIT 1`,
      [key, locale]
    );

    return rows[0] ? mapMailTemplateRow(rows[0]) : null;
  }

  async upsertTemplate(input: UpsertMailTemplateInput): Promise<MailTemplate> {
    const pool = getDatabasePool();
    await pool.execute(
      `INSERT INTO mail_templates (\`key\`, locale, subject, body_text, enabled)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         subject = VALUES(subject),
         body_text = VALUES(body_text),
         enabled = VALUES(enabled),
         updated_at = CURRENT_TIMESTAMP`,
      [input.key, input.locale, input.subject, input.bodyText, input.enabled ? 1 : 0]
    );

    const template = await this.findTemplate(input.key, input.locale);

    if (!template) {
      throw new Error("Mail template could not be loaded.");
    }

    return template;
  }

  async createLog(input: CreateMailLogInput): Promise<MailLog> {
    const pool = getDatabasePool();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO mail_logs (
         template_key,
         recipient,
         subject,
         status,
         message,
         provider_response,
         related_type,
         related_id
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.templateKey,
        input.recipient,
        input.subject,
        input.status,
        input.message ?? null,
        input.providerResponse ?? null,
        input.relatedType ?? null,
        input.relatedId ?? null
      ]
    );

    const log = await this.findLogById(result.insertId);

    if (!log) {
      throw new Error("Mail log could not be loaded.");
    }

    return log;
  }

  async findLogById(id: number): Promise<MailLog | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<MailLogRow[]>(
      `SELECT ${mailLogColumns}
       FROM mail_logs
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    return rows[0] ? mapMailLogRow(rows[0]) : null;
  }

  async listLogs(input: { limit?: number } = {}): Promise<MailLog[]> {
    const pool = getDatabasePool();
    const limit = Math.min(Math.max(Math.trunc(input.limit ?? 50), 1), 200);
    const [rows] = await pool.execute<MailLogRow[]>(
      `SELECT ${mailLogColumns}
       FROM mail_logs
       ORDER BY created_at DESC, id DESC
       LIMIT ${limit}`
    );

    return rows.map(mapMailLogRow);
  }
}
