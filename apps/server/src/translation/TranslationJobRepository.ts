import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getDatabasePool } from "../database/connection.js";
import type { GenerateSeoResult, TranslateResult } from "./TranslationService.js";

export type TranslationJobKind = "translate" | "seo";
export type TranslationJobStatus = "queued" | "running" | "succeeded" | "failed";
export type TranslationJobResult = { translation: TranslateResult } | { seo: GenerateSeoResult };

export type TranslationJob = {
  id: number;
  kind: TranslationJobKind;
  status: TranslationJobStatus;
  input: unknown;
  result: TranslationJobResult | null;
  errorMessage: string | null;
  attempts: number;
  lockedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type TranslationJobRow = RowDataPacket & {
  id: number;
  kind: TranslationJobKind;
  status: TranslationJobStatus;
  input_json: unknown;
  result_json: unknown;
  error_message: string | null;
  attempts: number;
  locked_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

const translationJobColumns = `
  id,
  kind,
  status,
  input_json,
  result_json,
  error_message,
  attempts,
  locked_at,
  started_at,
  completed_at,
  created_at,
  updated_at
`;

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function mapTranslationJobRow(row: TranslationJobRow): TranslationJob {
  return {
    attempts: Number(row.attempts),
    completedAt: row.completed_at,
    createdAt: row.created_at,
    errorMessage: row.error_message,
    id: Number(row.id),
    input: parseJsonValue(row.input_json),
    kind: row.kind,
    lockedAt: row.locked_at,
    result: parseJsonValue(row.result_json) as TranslationJobResult | null,
    startedAt: row.started_at,
    status: row.status,
    updatedAt: row.updated_at
  };
}

export class TranslationJobRepository {
  async createJob(kind: TranslationJobKind, input: unknown): Promise<TranslationJob> {
    const pool = getDatabasePool();
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO translation_jobs (kind, input_json) VALUES (?, ?)",
      [kind, JSON.stringify(input)]
    );
    const job = await this.findById(result.insertId);

    if (!job) {
      throw new Error("Created translation job could not be loaded.");
    }

    return job;
  }

  async findById(id: number): Promise<TranslationJob | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<TranslationJobRow[]>(
      `SELECT ${translationJobColumns}
       FROM translation_jobs
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    return rows[0] ? mapTranslationJobRow(rows[0]) : null;
  }

  async claimNextQueuedJob(): Promise<TranslationJob | null> {
    const pool = getDatabasePool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const row = await this.selectNextQueuedJobForUpdate(connection);

      if (!row) {
        await connection.commit();
        return null;
      }

      await connection.execute(
        `UPDATE translation_jobs
         SET status = 'running',
             attempts = attempts + 1,
             locked_at = CURRENT_TIMESTAMP,
             started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [row.id]
      );
      await connection.commit();

      return this.findById(row.id);
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async markSucceeded(id: number, result: TranslationJobResult): Promise<void> {
    const pool = getDatabasePool();

    await pool.execute(
      `UPDATE translation_jobs
       SET status = 'succeeded',
           result_json = ?,
           error_message = NULL,
           locked_at = NULL,
           completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [JSON.stringify(result), id]
    );
  }

  async markFailed(id: number, errorMessage: string): Promise<void> {
    const pool = getDatabasePool();

    await pool.execute(
      `UPDATE translation_jobs
       SET status = 'failed',
           error_message = ?,
           locked_at = NULL,
           completed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [errorMessage, id]
    );
  }

  private async selectNextQueuedJobForUpdate(connection: PoolConnection): Promise<TranslationJobRow | null> {
    const [rows] = await connection.execute<TranslationJobRow[]>(
      `SELECT ${translationJobColumns}
       FROM translation_jobs
       WHERE status = 'queued'
       ORDER BY created_at ASC, id ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`
    );

    return rows[0] ?? null;
  }
}
