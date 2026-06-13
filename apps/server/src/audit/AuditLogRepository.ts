import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getDatabasePool } from "../database/connection.js";

export type AuditLog = {
  id: number;
  userId: number | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: Date;
};

export type CreateAuditLogInput = {
  userId?: number | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: unknown;
};

export type ListAuditLogsInput = {
  userId?: number;
  action?: string;
  entityType?: string;
  entityId?: string;
  limit?: number;
  offset?: number;
};

type AuditLogRow = RowDataPacket & {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata_json: unknown;
  created_at: Date;
};

const auditLogColumns = [
  "id",
  "user_id",
  "action",
  "entity_type",
  "entity_id",
  "ip",
  "user_agent",
  "metadata_json",
  "created_at"
].join(", ");

function parseMetadata(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mapAuditLogRow(row: AuditLogRow): AuditLog {
  return {
    action: row.action,
    createdAt: row.created_at,
    entityId: row.entity_id,
    entityType: row.entity_type,
    id: row.id,
    ip: row.ip,
    metadata: parseMetadata(row.metadata_json),
    userAgent: row.user_agent,
    userId: row.user_id
  };
}

export class AuditLogRepository {
  async create(input: CreateAuditLogInput): Promise<AuditLog> {
    const pool = getDatabasePool();
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO audit_logs
        (user_id, action, entity_type, entity_id, ip, user_agent, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.userId ?? null,
        input.action,
        input.entityType,
        input.entityId === undefined || input.entityId === null ? null : String(input.entityId),
        input.ip ?? null,
        input.userAgent ?? null,
        input.metadata === undefined ? null : JSON.stringify(input.metadata)
      ]
    );

    const log = await this.findById(result.insertId);

    if (!log) {
      throw new Error("Created audit log could not be loaded.");
    }

    return log;
  }

  async list(input: ListAuditLogsInput = {}): Promise<AuditLog[]> {
    const pool = getDatabasePool();
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (input.userId !== undefined) {
      where.push("user_id = ?");
      params.push(input.userId);
    }

    if (input.action !== undefined) {
      where.push("action = ?");
      params.push(input.action);
    }

    if (input.entityType !== undefined) {
      where.push("entity_type = ?");
      params.push(input.entityType);
    }

    if (input.entityId !== undefined) {
      where.push("entity_id = ?");
      params.push(input.entityId);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const limit = Number.isInteger(input.limit) && input.limit && input.limit > 0 ? input.limit : 50;
    const offset = Number.isInteger(input.offset) && input.offset && input.offset > 0 ? input.offset : 0;
    const [rows] = await pool.execute<AuditLogRow[]>(
      `SELECT ${auditLogColumns}
       FROM audit_logs
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return rows.map(mapAuditLogRow);
  }

  private async findById(id: number): Promise<AuditLog | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<AuditLogRow[]>(`SELECT ${auditLogColumns} FROM audit_logs WHERE id = ? LIMIT 1`, [
      id
    ]);

    return rows[0] ? mapAuditLogRow(rows[0]) : null;
  }
}
