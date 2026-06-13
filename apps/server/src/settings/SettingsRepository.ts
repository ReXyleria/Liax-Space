import type { RowDataPacket } from "mysql2/promise";

import { getDatabasePool } from "../database/connection.js";
import type { PreferenceLocale, SiteSettings, UserPreferences } from "./settings.types.js";

type SiteSettingRow = RowDataPacket & {
  key: string;
  value_json: unknown;
};

type UserPreferencesRow = RowDataPacket & {
  avatar_attachment_id: number | null;
  avatar_public_url: string | null;
  user_id: number;
  locale: PreferenceLocale;
  reduced_motion: number | boolean;
  created_at: Date;
  updated_at: Date;
};

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

function mapUserPreferencesRow(row: UserPreferencesRow): UserPreferences {
  return {
    avatarAttachmentId: row.avatar_attachment_id,
    avatarPublicUrl: row.avatar_public_url,
    userId: row.user_id,
    locale: row.locale,
    reducedMotion: Boolean(row.reduced_motion),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class SettingsRepository {
  async getSiteSettings(): Promise<SiteSettings> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<SiteSettingRow[]>("SELECT `key`, value_json FROM site_settings ORDER BY `key` ASC");

    return Object.fromEntries(rows.map((row) => [row.key, parseJsonValue(row.value_json)]));
  }

  async updateSiteSettings(settings: SiteSettings): Promise<SiteSettings> {
    const pool = getDatabasePool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const [key, value] of Object.entries(settings)) {
        await connection.execute(
          `INSERT INTO site_settings (\`key\`, value_json)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_at = CURRENT_TIMESTAMP`,
          [key, JSON.stringify(value)]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return this.getSiteSettings();
  }

  async getUserPreferences(userId: number): Promise<UserPreferences | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<UserPreferencesRow[]>(
      `SELECT
         up.user_id,
         up.locale,
         up.reduced_motion,
         up.avatar_attachment_id,
         avatar.public_url AS avatar_public_url,
         up.created_at,
         up.updated_at
       FROM user_preferences up
       LEFT JOIN attachments avatar
         ON avatar.id = up.avatar_attachment_id
        AND avatar.deleted_at IS NULL
       WHERE up.user_id = ?
       LIMIT 1`,
      [userId]
    );

    return rows[0] ? mapUserPreferencesRow(rows[0]) : null;
  }

  async upsertUserPreferences(input: {
    avatarAttachmentId: number | null;
    userId: number;
    locale: PreferenceLocale;
    reducedMotion: boolean;
  }): Promise<UserPreferences> {
    const pool = getDatabasePool();

    await pool.execute(
      `INSERT INTO user_preferences (user_id, locale, reduced_motion, avatar_attachment_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         locale = VALUES(locale),
         reduced_motion = VALUES(reduced_motion),
         avatar_attachment_id = VALUES(avatar_attachment_id),
         updated_at = CURRENT_TIMESTAMP`,
      [input.userId, input.locale, input.reducedMotion, input.avatarAttachmentId]
    );

    const preferences = await this.getUserPreferences(input.userId);

    if (!preferences) {
      throw new Error("User preferences could not be loaded.");
    }

    return preferences;
  }
}
