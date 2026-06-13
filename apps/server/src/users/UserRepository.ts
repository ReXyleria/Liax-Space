import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getDatabasePool } from "../database/connection.js";
import type { CreateUserRecordInput, UpdateUserRoleInput, UserListInput, UserRecord, UserRole } from "./users.types.js";

type UserRow = RowDataPacket & {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
  disabled_at: Date | null;
};

const userColumns = [
  "id",
  "username",
  "email",
  "password_hash",
  "role",
  "created_at",
  "updated_at",
  "last_login_at",
  "disabled_at"
].join(", ");

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
    disabledAt: row.disabled_at
  };
}

export class UserRepository {
  async listUsers(input: UserListInput = {}): Promise<UserRecord[]> {
    const pool = getDatabasePool();
    const limit = Math.min(Math.max(Math.trunc(input.limit ?? 50), 1), 100);
    const offset = Math.max(Math.trunc(input.offset ?? 0), 0);
    const search = input.search?.trim();
    const params: string[] = [];
    const clauses = ["1 = 1"];

    if (search) {
      clauses.push("(username LIKE ? OR email LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    const [rows] = await pool.execute<UserRow[]>(
      `SELECT ${userColumns}
       FROM users
       WHERE ${clauses.join(" AND ")}
       ORDER BY id ASC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    return rows.map(mapUserRow);
  }

  async createUser(input: CreateUserRecordInput): Promise<UserRecord> {
    const pool = getDatabasePool();
    const [result] = await pool.execute<ResultSetHeader>(
      "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [input.username, input.email, input.passwordHash, input.role]
    );

    const user = await this.findById(result.insertId);

    if (!user) {
      throw new Error("Created user could not be loaded.");
    }

    return user;
  }

  async findById(id: number): Promise<UserRecord | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<UserRow[]>(`SELECT ${userColumns} FROM users WHERE id = ? LIMIT 1`, [id]);

    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<UserRow[]>(`SELECT ${userColumns} FROM users WHERE email = ? LIMIT 1`, [email]);

    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async findByEmailOrUsername(identifier: string): Promise<UserRecord | null> {
    const pool = getDatabasePool();
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const [rows] = await pool.execute<UserRow[]>(
      `SELECT ${userColumns}
       FROM users
       WHERE LOWER(email) = ? OR LOWER(username) = ?
       ORDER BY id ASC
       LIMIT 1`,
      [normalizedIdentifier, normalizedIdentifier]
    );

    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async findAdminUser(): Promise<UserRecord | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<UserRow[]>(
      `SELECT ${userColumns} FROM users WHERE role = ? ORDER BY id ASC LIMIT 1`,
      ["admin"]
    );

    return rows[0] ? mapUserRow(rows[0]) : null;
  }

  async updateLastLoginAt(id: number, lastLoginAt = new Date()): Promise<UserRecord | null> {
    const pool = getDatabasePool();
    await pool.execute("UPDATE users SET last_login_at = ? WHERE id = ?", [lastLoginAt, id]);

    return this.findById(id);
  }

  async disableUser(id: number, disabledAt = new Date()): Promise<UserRecord | null> {
    const pool = getDatabasePool();
    await pool.execute("UPDATE users SET disabled_at = ? WHERE id = ?", [disabledAt, id]);

    return this.findById(id);
  }

  async updateUserRole(input: UpdateUserRoleInput): Promise<UserRecord | null> {
    const pool = getDatabasePool();
    await pool.execute("UPDATE users SET role = ? WHERE id = ?", [input.role, input.id]);

    return this.findById(input.id);
  }

  async updateManyRoles(ids: number[], role: UserRole): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const pool = getDatabasePool();
    const placeholders = ids.map(() => "?").join(", ");
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE users SET role = ? WHERE id IN (${placeholders})`,
      [role, ...ids]
    );

    return result.affectedRows;
  }

  async disableManyUsers(ids: number[], disabledAt = new Date()): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const pool = getDatabasePool();
    const placeholders = ids.map(() => "?").join(", ");
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE users SET disabled_at = ? WHERE id IN (${placeholders}) AND disabled_at IS NULL`,
      [disabledAt, ...ids]
    );

    return result.affectedRows;
  }
}
