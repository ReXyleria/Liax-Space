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

type LegacyMomentRow = RowDataPacket & {
  content: string;
  images: string | null;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
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
  legacyArticleTagLinks: number;
  legacyMoments: number;
  legacyTags: number;
  momentImages: number;
  momentsInserted: number;
  skippedArticleTagLinks: number;
  tagTranslationsInserted: number;
  tagsInserted: number;
  targetMomentsBefore: number;
  targetTagsBefore: number;
};

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

    options.onProgress?.("reading legacy moments");
    const legacyMoments = await this.listLegacyMoments();

    const baseResult: LegacyPublicDataSyncResult = {
      applied: false,
      articleTagLinksInserted: 0,
      legacyArticleTagLinks: legacyArticleTags.length,
      legacyMoments: legacyMoments.length,
      legacyTags: legacyTags.length,
      momentImages: legacyMoments.reduce((count, moment) => count + normalizeLegacyImages(moment.images).length, 0),
      momentsInserted: 0,
      skippedArticleTagLinks: 0,
      tagTranslationsInserted: 0,
      tagsInserted: 0,
      targetMomentsBefore: targetCounts.moments,
      targetTagsBefore: targetCounts.tags
    };

    if (!options.apply) {
      options.onProgress?.("dry run complete");
      return baseResult;
    }

    if (targetCounts.tags > 0 || targetCounts.moments > 0) {
      throw new Error(`Target database is not empty: tags=${targetCounts.tags}, moments=${targetCounts.moments}.`);
    }

    await this.targetDatabase.beginTransaction();
    options.onProgress?.("target transaction started");

    try {
      const tagIdBySlug = new Map<string, number>();

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

      options.onProgress?.("reading target article ids");
      const articleIdBySlug = await this.getTargetArticleIdsBySlug();

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

  private async listLegacyMoments(): Promise<LegacyMomentRow[]> {
    const [rows] = await this.legacyDatabase.query<LegacyMomentRow[]>(
      "SELECT content, CAST(images AS CHAR) AS images, visibility, createdAt, updatedAt, deletedAt FROM Moment ORDER BY createdAt ASC, id ASC"
    );

    return rows;
  }
}
