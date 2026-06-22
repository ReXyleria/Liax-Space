import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

type Queryable = {
  execute<T>(sql: string, params?: unknown): Promise<[T, unknown]>;
  query<T>(sql: string, params?: unknown): Promise<[T, unknown]>;
};

type TransactionalQueryable = Queryable & {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
};

type LegacyTagRow = RowDataPacket & {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
};

type LegacyArticleTagRow = RowDataPacket & {
  articleSlug: string;
  tagSlug: string;
};

type LegacyArticleVisibilityRow = RowDataPacket & {
  articleSlug: string;
  visibility: string | null;
};

type LegacyArticlePublishedAtRow = RowDataPacket & {
  articleSlug: string;
  publishedAt: Date;
};

type LegacyMomentRow = RowDataPacket & {
  content: string;
  images: string | null;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type LegacySiteSettingRow = RowDataPacket & {
  key: string;
  value_json: unknown;
};

type LegacySettingRow = RowDataPacket & {
  key: string;
  type: string | null;
  value: unknown;
};

type TableExistsRow = RowDataPacket & {
  count: number;
};

type ExistingTargetCountsRow = RowDataPacket & {
  moments: number;
  tags: number;
};

type TargetArticleSlugRow = RowDataPacket & {
  article_id: number;
  slug: string;
};

export type LegacyPublicDataSyncOptions = {
  apply: boolean;
  onProgress?: (message: string) => void;
};

export type LegacyPublicDataSyncResult = {
  applied: boolean;
  articleTagLinksInserted: number;
  articlePublishedAtUpdated: number;
  articleVisibilitiesUpdated: number;
  legacyArticleTagLinks: number;
  legacyArticlePublishedAt: number;
  legacyArticleVisibilities: number;
  legacyMoments: number;
  legacyPortableSiteSettings: number;
  legacyTags: number;
  momentImages: number;
  momentsInserted: number;
  skippedArticleTagLinks: number;
  skippedArticleVisibilities: number;
  siteSettingsUpserted: number;
  tagTranslationsInserted: number;
  tagsInserted: number;
  targetMomentsBefore: number;
  targetTagsBefore: number;
};

const portableSiteSettingKeys = [
  "ai.apiKey",
  "ai.baseUrl",
  "ai.deepseekBaseUrl",
  "ai.deepseekModel",
  "ai.model",
  "ai.provider",
  "ai.translationTemperature",
  "smtp.encryption",
  "smtp.from",
  "smtp.fromName",
  "smtp.host",
  "smtp.notificationsEnabled",
  "smtp.pass",
  "smtp.port",
  "smtp.user"
] as const;

const legacySettingKeyMap: Record<string, (typeof portableSiteSettingKeys)[number]> = {
  "smtp.encryption": "smtp.encryption",
  "smtp.from": "smtp.from",
  "smtp.fromName": "smtp.fromName",
  "smtp.host": "smtp.host",
  "smtp.notificationsEnabled": "smtp.notificationsEnabled",
  "smtp.pass": "smtp.pass",
  "smtp.port": "smtp.port",
  "smtp.user": "smtp.user",
  "translation.apiKey": "ai.apiKey",
  "translation.baseUrl": "ai.baseUrl",
  "translation.model": "ai.model",
  "translation.provider": "ai.provider"
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

function readBooleanValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
  }

  return false;
}

function readNumberValue(value: unknown): unknown {
  const numberValue = typeof value === "string" ? Number(value.trim()) : value;
  return typeof numberValue === "number" && Number.isFinite(numberValue) ? numberValue : value;
}

function normalizeLegacyProvider(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === "openai" || normalized === "ollama" || normalized === "deepseek") {
    return normalized;
  }

  return normalized;
}

function normalizeLegacySmtpEncryption(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase().replace(/[\s/-]+/gu, "_");

  if (normalized === "ssl_tls" || normalized === "ssltls") {
    return "ssl_tls";
  }

  if (normalized === "starttls" || normalized === "start_tls" || normalized === "tls") {
    return "starttls";
  }

  if (normalized === "none" || normalized === "off" || normalized === "false") {
    return "none";
  }

  return normalized;
}

function normalizeLegacySettingValue(key: string, type: string | null, value: unknown): unknown {
  const parsedValue = parseJsonValue(value);
  const normalizedType = typeof type === "string" ? type.trim().toUpperCase() : "";

  if (key === "ai.provider") {
    return normalizeLegacyProvider(parsedValue);
  }

  if (key === "smtp.encryption") {
    return normalizeLegacySmtpEncryption(parsedValue);
  }

  if (key === "smtp.notificationsEnabled" || normalizedType === "BOOLEAN") {
    return readBooleanValue(parsedValue);
  }

  if (key === "smtp.port" || key === "ai.translationTemperature" || normalizedType === "NUMBER") {
    return readNumberValue(parsedValue);
  }

  return typeof parsedValue === "string" ? parsedValue.trim() : parsedValue;
}

export function normalizeLegacyImages(value: unknown): string[] {
  if (!value) {
    return [];
  }

  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((item) => {
    if (typeof item === "string") {
      const image = item.trim();
      return image ? [image] : [];
    }

    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      for (const key of ["url", "src", "path"]) {
        const candidate = record[key];
        if (typeof candidate === "string") {
          const image = candidate.trim();
          return image ? [image] : [];
        }
      }
    }

    return [];
  });
}

export function mapLegacyMomentStatus(visibility: string, deletedAt: Date | null): "draft" | "published" {
  return visibility === "PUBLIC" && !deletedAt ? "published" : "draft";
}

export function mapLegacyArticleAllowedRoles(visibility: string | null | undefined): string[] {
  const normalized = typeof visibility === "string" ? visibility.trim().toUpperCase() : "";

  if (!normalized || normalized === "PUBLIC" || normalized === "GUEST") {
    return [];
  }

  const tokens = normalized.split(/[^A-Z0-9]+/u).filter(Boolean);
  const roles = new Set<string>();

  if (tokens.includes("SSVIP")) {
    roles.add("ssvip");
  }

  if (tokens.includes("SVIP")) {
    roles.add("svip");
  }

  if (normalized.includes("LOGIN") || normalized.includes("AUTH") || normalized.includes("MEMBER") || normalized === "VIP") {
    roles.add("svip");
    roles.add("ssvip");
  }

  if (roles.size > 0) {
    return [...roles];
  }

  return ["ssvip"];
}

export class LegacyPublicDataSyncJob {
  constructor(
    private readonly legacyDatabase: Queryable,
    private readonly targetDatabase: TransactionalQueryable
  ) {}

  async run(options: LegacyPublicDataSyncOptions): Promise<LegacyPublicDataSyncResult> {
    options.onProgress?.("reading target public data counts");
    const targetCounts = await this.getTargetCounts();

    options.onProgress?.("reading legacy tags");
    const legacyTags = await this.listLegacyTags();

    options.onProgress?.("reading legacy article tag links");
    const legacyArticleTags = await this.listLegacyArticleTags();

    options.onProgress?.("reading legacy article visibility");
    const legacyArticleVisibilities = await this.listLegacyArticleVisibilities();

    options.onProgress?.("reading legacy article published dates");
    const legacyArticlePublishedDates = await this.listLegacyArticlePublishedDates();

    options.onProgress?.("reading legacy moments");
    const legacyMoments = await this.listLegacyMoments();

    options.onProgress?.("reading legacy portable site settings");
    const legacyPortableSiteSettings = await this.listLegacyPortableSiteSettings();

    const baseResult: LegacyPublicDataSyncResult = {
      applied: false,
      articleTagLinksInserted: 0,
      articlePublishedAtUpdated: 0,
      articleVisibilitiesUpdated: 0,
      legacyArticleTagLinks: legacyArticleTags.length,
      legacyArticlePublishedAt: legacyArticlePublishedDates.length,
      legacyArticleVisibilities: legacyArticleVisibilities.length,
      legacyMoments: legacyMoments.length,
      legacyPortableSiteSettings: legacyPortableSiteSettings.length,
      legacyTags: legacyTags.length,
      momentImages: legacyMoments.reduce((count, moment) => count + normalizeLegacyImages(moment.images).length, 0),
      momentsInserted: 0,
      skippedArticleTagLinks: 0,
      skippedArticleVisibilities: 0,
      siteSettingsUpserted: 0,
      tagTranslationsInserted: 0,
      tagsInserted: 0,
      targetMomentsBefore: targetCounts.moments,
      targetTagsBefore: targetCounts.tags
    };

    if (!options.apply) {
      options.onProgress?.("dry run complete");
      return baseResult;
    }

    const canInsertPublicData = targetCounts.tags === 0 && targetCounts.moments === 0;

    await this.targetDatabase.beginTransaction();
    options.onProgress?.("target transaction started");

    try {
      const tagIdBySlug = new Map<string, number>();

      if (canInsertPublicData) {
        options.onProgress?.("inserting target tags");
        for (const tag of legacyTags) {
          const [result] = await this.targetDatabase.execute<ResultSetHeader>(
            "INSERT INTO tags (created_at) VALUES (?)",
            [tag.createdAt]
          );
          tagIdBySlug.set(tag.slug, result.insertId);
          baseResult.tagsInserted += 1;

          await this.targetDatabase.execute(
            `INSERT INTO tag_translations (tag_id, locale, name, slug)
             VALUES (?, 'zh-CN', ?, ?), (?, 'en-US', ?, ?)`,
            [result.insertId, tag.name, tag.slug, result.insertId, tag.name, tag.slug]
          );
          baseResult.tagTranslationsInserted += 2;
        }
      } else {
        options.onProgress?.("target public data already exists; skipping tag and moment insertion");
      }

      options.onProgress?.("reading target article ids");
      const articleIdBySlug = await this.getTargetArticleIdsBySlug();

      if (canInsertPublicData) {
        options.onProgress?.("inserting target article tag links");
        for (const articleTag of legacyArticleTags) {
          const articleId = articleIdBySlug.get(articleTag.articleSlug);
          const tagId = tagIdBySlug.get(articleTag.tagSlug);

          if (!articleId || !tagId) {
            baseResult.skippedArticleTagLinks += 1;
            continue;
          }

          await this.targetDatabase.execute(
            "INSERT IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)",
            [articleId, tagId]
          );
          baseResult.articleTagLinksInserted += 1;
        }
      } else {
        baseResult.skippedArticleTagLinks = legacyArticleTags.length;
      }

      options.onProgress?.("updating target article visibility");
      for (const articleVisibility of legacyArticleVisibilities) {
        const articleId = articleIdBySlug.get(articleVisibility.articleSlug);

        if (!articleId) {
          baseResult.skippedArticleVisibilities += 1;
          continue;
        }

        const allowedRoles = mapLegacyArticleAllowedRoles(articleVisibility.visibility);
        const [result] = await this.targetDatabase.execute<ResultSetHeader>(
          "UPDATE article_translations SET allowed_roles_json = ? WHERE article_id = ?",
          [JSON.stringify(allowedRoles), articleId]
        );
        baseResult.articleVisibilitiesUpdated += result.affectedRows;
      }

      options.onProgress?.("updating target article published dates");
      for (const articlePublishedAt of legacyArticlePublishedDates) {
        const articleId = articleIdBySlug.get(articlePublishedAt.articleSlug);

        if (!articleId) {
          continue;
        }

        const [result] = await this.targetDatabase.execute<ResultSetHeader>(
          `UPDATE article_translations
           SET published_at = ?
           WHERE article_id = ?
             AND published_version_id IS NOT NULL`,
          [articlePublishedAt.publishedAt, articleId]
        );
        baseResult.articlePublishedAtUpdated += result.affectedRows;
      }

      if (canInsertPublicData) {
        options.onProgress?.("inserting target moments");
        for (const moment of legacyMoments) {
          const images = normalizeLegacyImages(moment.images);
          const status = mapLegacyMomentStatus(moment.visibility, moment.deletedAt);

          await this.targetDatabase.execute(
            `INSERT INTO moments (author_id, locale, content, images_json, status, created_at, updated_at, published_at, deleted_at)
             VALUES (NULL, 'zh-CN', ?, ?, ?, ?, ?, ?, ?)`,
            [
              moment.content,
              JSON.stringify(images),
              status,
              moment.createdAt,
              moment.updatedAt,
              status === "published" ? moment.createdAt : null,
              moment.deletedAt
            ]
          );
          baseResult.momentsInserted += 1;
        }
      }

      options.onProgress?.("upserting target SMTP and AI settings");
      for (const setting of legacyPortableSiteSettings) {
        const [result] = await this.targetDatabase.execute<ResultSetHeader>(
          `INSERT INTO site_settings (\`key\`, value_json)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_at = CURRENT_TIMESTAMP`,
          [setting.key, JSON.stringify(parseJsonValue(setting.value_json))]
        );
        baseResult.siteSettingsUpserted += result.affectedRows > 0 ? 1 : 0;
      }

      await this.targetDatabase.commit();
      baseResult.applied = true;
      options.onProgress?.("target transaction committed");

      return baseResult;
    } catch (error) {
      await this.targetDatabase.rollback();
      throw error;
    }
  }

  private async getTargetCounts(): Promise<{ moments: number; tags: number }> {
    const [rows] = await this.targetDatabase.query<ExistingTargetCountsRow[]>(
      "SELECT (SELECT COUNT(*) FROM tags) AS tags, (SELECT COUNT(*) FROM moments) AS moments"
    );
    const [counts] = rows;

    return {
      moments: Number(counts?.moments ?? 0),
      tags: Number(counts?.tags ?? 0)
    };
  }

  private async getTargetArticleIdsBySlug(): Promise<Map<string, number>> {
    const [rows] = await this.targetDatabase.query<TargetArticleSlugRow[]>(
      "SELECT article_id, slug FROM article_translations ORDER BY locale = 'zh-CN' DESC, id ASC"
    );
    const articleIdBySlug = new Map<string, number>();

    for (const row of rows) {
      if (!articleIdBySlug.has(row.slug)) {
        articleIdBySlug.set(row.slug, row.article_id);
      }
    }

    return articleIdBySlug;
  }

  private async listLegacyTags(): Promise<LegacyTagRow[]> {
    const [rows] = await this.legacyDatabase.query<LegacyTagRow[]>(
      "SELECT id, name, slug, createdAt FROM Tag ORDER BY createdAt ASC, id ASC"
    );

    return rows;
  }

  private async listLegacyArticleTags(): Promise<LegacyArticleTagRow[]> {
    const [rows] = await this.legacyDatabase.query<LegacyArticleTagRow[]>(
      `SELECT a.slug AS articleSlug, t.slug AS tagSlug
       FROM ArticleTag article_tag
       INNER JOIN Article a ON a.id = article_tag.articleId
       INNER JOIN Tag t ON t.id = article_tag.tagId
       WHERE a.deletedAt IS NULL
       ORDER BY a.slug ASC, t.slug ASC`
    );

    return rows;
  }

  private async listLegacyArticleVisibilities(): Promise<LegacyArticleVisibilityRow[]> {
    const [rows] = await this.legacyDatabase.query<LegacyArticleVisibilityRow[]>(
      "SELECT slug AS articleSlug, visibility FROM Article WHERE deletedAt IS NULL ORDER BY slug ASC, id ASC"
    );

    return rows;
  }

  private async listLegacyArticlePublishedDates(): Promise<LegacyArticlePublishedAtRow[]> {
    const [rows] = await this.legacyDatabase.query<LegacyArticlePublishedAtRow[]>(
      "SELECT slug AS articleSlug, COALESCE(publishedAt, createdAt) AS publishedAt FROM Article WHERE deletedAt IS NULL ORDER BY slug ASC, id ASC"
    );

    return rows;
  }

  private async listLegacyMoments(): Promise<LegacyMomentRow[]> {
    const [rows] = await this.legacyDatabase.query<LegacyMomentRow[]>(
      "SELECT content, CAST(images AS CHAR) AS images, visibility, createdAt, updatedAt, deletedAt FROM Moment ORDER BY createdAt ASC, id ASC"
    );

    return rows;
  }

  private async listLegacyPortableSiteSettings(): Promise<LegacySiteSettingRow[]> {
    const settings = new Map<string, unknown>();
    const siteSettings = await this.listLegacySiteSettingsTablePortableSettings();
    const settingRows = await this.listLegacySettingTablePortableSettings();

    for (const setting of [...siteSettings, ...settingRows]) {
      settings.set(setting.key, setting.value_json);
    }

    return [...settings.entries()]
      .map(([key, value_json]) => ({ key, value_json }) as LegacySiteSettingRow)
      .sort((left, right) => left.key.localeCompare(right.key));
  }

  private async legacyTableExists(tableName: string): Promise<boolean> {
    const [tableRows] = await this.legacyDatabase.query<TableExistsRow[]>(
      `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?`,
      [tableName]
    );

    return Number(tableRows[0]?.count ?? 0) > 0;
  }

  private async listLegacySiteSettingsTablePortableSettings(): Promise<LegacySiteSettingRow[]> {
    if (!(await this.legacyTableExists("site_settings"))) {
      return [];
    }

    const placeholders = portableSiteSettingKeys.map(() => "?").join(", ");
    const [rows] = await this.legacyDatabase.query<LegacySiteSettingRow[]>(
      `SELECT \`key\`, value_json
       FROM site_settings
       WHERE \`key\` IN (${placeholders})
       ORDER BY \`key\` ASC`,
      [...portableSiteSettingKeys]
    );

    return rows;
  }

  private async listLegacySettingTablePortableSettings(): Promise<LegacySiteSettingRow[]> {
    if (!(await this.legacyTableExists("Setting"))) {
      return [];
    }

    const legacySettingKeys = Object.keys(legacySettingKeyMap);
    const placeholders = legacySettingKeys.map(() => "?").join(", ");
    const [rows] = await this.legacyDatabase.query<LegacySettingRow[]>(
      `SELECT \`key\`, \`type\`, \`value\`
       FROM Setting
       WHERE \`key\` IN (${placeholders})
       ORDER BY \`key\` ASC`,
      legacySettingKeys
    );

    return rows.map((row) => {
      const targetKey = legacySettingKeyMap[row.key];
      return {
        key: targetKey,
        value_json: normalizeLegacySettingValue(targetKey, row.type, row.value)
      } as LegacySiteSettingRow;
    });
  }
}
