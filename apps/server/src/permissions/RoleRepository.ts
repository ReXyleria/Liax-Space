import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getDatabasePool } from "../database/connection.js";
import type { Permission } from "./permissions.js";

export type RoleDefinition = {
  roleKey: string;
  displayName: string;
  permissions: Permission[];
  builtIn: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type RoleDefinitionInput = {
  roleKey: string;
  displayName: string;
  permissions: Permission[];
  builtIn?: boolean;
};

type RoleDefinitionRow = RowDataPacket & {
  role_key: string;
  display_name: string;
  permissions_json: string | Permission[];
  built_in: 0 | 1;
  created_at: Date;
  updated_at: Date;
};

function parsePermissions(value: string | Permission[]): Permission[] {
  if (Array.isArray(value)) {
    return value;
  }

  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.filter((item): item is Permission => typeof item === "string") : [];
}

function mapRoleDefinitionRow(row: RoleDefinitionRow): RoleDefinition {
  return {
    builtIn: Boolean(row.built_in),
    createdAt: row.created_at,
    displayName: row.display_name,
    permissions: parsePermissions(row.permissions_json),
    roleKey: row.role_key,
    updatedAt: row.updated_at
  };
}

export class RoleRepository {
  async listRoles(): Promise<RoleDefinition[]> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<RoleDefinitionRow[]>(
      `SELECT role_key, display_name, permissions_json, built_in, created_at, updated_at
       FROM role_definitions
       ORDER BY built_in DESC, role_key ASC`
    );

    return rows.map(mapRoleDefinitionRow);
  }

  async findByRoleKey(roleKey: string): Promise<RoleDefinition | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<RoleDefinitionRow[]>(
      `SELECT role_key, display_name, permissions_json, built_in, created_at, updated_at
       FROM role_definitions
       WHERE role_key = ?
       LIMIT 1`,
      [roleKey]
    );

    return rows[0] ? mapRoleDefinitionRow(rows[0]) : null;
  }

  async createRole(input: RoleDefinitionInput): Promise<RoleDefinition> {
    const pool = getDatabasePool();
    await pool.execute<ResultSetHeader>(
      `INSERT INTO role_definitions (role_key, display_name, permissions_json, built_in)
       VALUES (?, ?, ?, ?)`,
      [input.roleKey, input.displayName, JSON.stringify(input.permissions), input.builtIn ?? false]
    );
    const role = await this.findByRoleKey(input.roleKey);

    if (!role) {
      throw new Error("Created role could not be loaded.");
    }

    return role;
  }

  async updateRole(roleKey: string, input: Pick<RoleDefinitionInput, "displayName" | "permissions">): Promise<RoleDefinition | null> {
    const pool = getDatabasePool();
    await pool.execute(
      `UPDATE role_definitions
       SET display_name = ?, permissions_json = ?
       WHERE role_key = ?`,
      [input.displayName, JSON.stringify(input.permissions), roleKey]
    );

    return this.findByRoleKey(roleKey);
  }

  async deleteRole(roleKey: string): Promise<boolean> {
    const pool = getDatabasePool();
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM role_definitions WHERE role_key = ? AND built_in = FALSE",
      [roleKey]
    );

    return result.affectedRows > 0;
  }

  async countUsersByRole(roleKey: string): Promise<number> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<Array<RowDataPacket & { total: number }>>(
      "SELECT COUNT(*) AS total FROM users WHERE role = ? AND disabled_at IS NULL",
      [roleKey]
    );

    return Number(rows[0]?.total ?? 0);
  }
}
