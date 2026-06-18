import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getDatabasePool } from "../database/connection.js";

export type SeoPushProvider = "baidu" | "google" | "indexnow";
export type SeoPushStatus = "failed" | "skipped" | "success";

export type SeoPushSubmission = {
  id: number;
  provider: SeoPushProvider;
  status: SeoPushStatus;
  submittedCount: number;
  statusCode: number | null;
  requestUrl: string | null;
  message: string | null;
  urls: string[];
  createdAt: Date;
};

export type CreateSeoPushSubmissionInput = {
  provider: SeoPushProvider;
  status: SeoPushStatus;
  submittedCount: number;
  statusCode?: number | null;
  requestUrl?: string | null;
  message?: string | null;
  urls?: string[];
};

type SeoPushSubmissionRow = RowDataPacket & {
  id: number;
  provider: SeoPushProvider;
  status: SeoPushStatus;
  submitted_count: number;
  status_code: number | null;
  request_url: string | null;
  message: string | null;
  urls_json: unknown;
  created_at: Date;
};

const seoPushColumns = [
  "id",
  "provider",
  "status",
  "submitted_count",
  "status_code",
  "request_url",
  "message",
  "urls_json",
  "created_at"
].join(", ");

function parseUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mapSeoPushSubmission(row: SeoPushSubmissionRow): SeoPushSubmission {
  return {
    createdAt: row.created_at,
    id: row.id,
    message: row.message,
    provider: row.provider,
    requestUrl: row.request_url,
    status: row.status,
    statusCode: row.status_code,
    submittedCount: row.submitted_count,
    urls: parseUrls(row.urls_json)
  };
}

export class SeoPushRepository {
  async create(input: CreateSeoPushSubmissionInput): Promise<SeoPushSubmission> {
    const pool = getDatabasePool();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO seo_push_submissions
        (provider, status, submitted_count, status_code, request_url, message, urls_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.provider,
        input.status,
        input.submittedCount,
        input.statusCode ?? null,
        input.requestUrl ?? null,
        input.message ?? null,
        JSON.stringify(input.urls ?? [])
      ]
    );

    const submission = await this.findById(result.insertId);

    if (!submission) {
      throw new Error("Created SEO push submission could not be loaded.");
    }

    return submission;
  }

  async listRecent(limit = 30): Promise<SeoPushSubmission[]> {
    const pool = getDatabasePool();
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    const [rows] = await pool.execute<SeoPushSubmissionRow[]>(
      `SELECT ${seoPushColumns}
       FROM seo_push_submissions
       ORDER BY created_at DESC, id DESC
       LIMIT ${safeLimit}`
    );

    return rows.map(mapSeoPushSubmission);
  }

  private async findById(id: number): Promise<SeoPushSubmission | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<SeoPushSubmissionRow[]>(
      `SELECT ${seoPushColumns} FROM seo_push_submissions WHERE id = ? LIMIT 1`,
      [id]
    );

    return rows[0] ? mapSeoPushSubmission(rows[0]) : null;
  }
}
