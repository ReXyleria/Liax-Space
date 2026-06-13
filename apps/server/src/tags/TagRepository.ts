import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { getDatabasePool } from "../database/connection.js";
import type { ArticleLocale } from "../articles/articles.types.js";

export type Tag = {
  id: number;
  createdAt: Date;
};

export type TagTranslation = {
  tagId: number;
  locale: ArticleLocale;
  name: string;
  slug: string;
};

export type TagDetail = {
  tag: Tag;
  translations: TagTranslation[];
};

export type TagTranslationInput = {
  tagId: number;
  locale: ArticleLocale;
  name: string;
  slug: string;
};

type TagRow = RowDataPacket & {
  id: number;
  created_at: Date;
};

type TagTranslationRow = RowDataPacket & {
  tag_id: number;
  locale: ArticleLocale;
  name: string;
  slug: string;
};

const tagColumns = ["id", "created_at"].join(", ");
const tagTranslationColumns = ["tag_id", "locale", "name", "slug"].join(", ");

function mapTagRow(row: TagRow): Tag {
  return {
    id: row.id,
    createdAt: row.created_at
  };
}

function mapTagTranslationRow(row: TagTranslationRow): TagTranslation {
  return {
    tagId: row.tag_id,
    locale: row.locale,
    name: row.name,
    slug: row.slug
  };
}

function groupTranslations(tags: Tag[], translations: TagTranslation[]): TagDetail[] {
  const translationsByTagId = new Map<number, TagTranslation[]>();

  for (const translation of translations) {
    const current = translationsByTagId.get(translation.tagId) ?? [];
    current.push(translation);
    translationsByTagId.set(translation.tagId, current);
  }

  return tags.map((tag) => ({
    tag,
    translations: translationsByTagId.get(tag.id) ?? []
  }));
}

export class TagRepository {
  async createTag(): Promise<Tag> {
    const pool = getDatabasePool();
    const [result] = await pool.execute<ResultSetHeader>("INSERT INTO tags (created_at) VALUES (CURRENT_TIMESTAMP)");
    const tag = await this.findById(result.insertId);

    if (!tag) {
      throw new Error("Created tag could not be loaded.");
    }

    return tag;
  }

  async listTags(): Promise<TagDetail[]> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<TagRow[]>(`SELECT ${tagColumns} FROM tags ORDER BY created_at DESC, id DESC`);
    const tags = rows.map(mapTagRow);

    return this.attachTranslations(tags);
  }

  async findById(id: number): Promise<Tag | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<TagRow[]>(`SELECT ${tagColumns} FROM tags WHERE id = ? LIMIT 1`, [id]);

    return rows[0] ? mapTagRow(rows[0]) : null;
  }

  async findDetailById(id: number): Promise<TagDetail | null> {
    const tag = await this.findById(id);

    if (!tag) {
      return null;
    }

    const [detail] = await this.attachTranslations([tag]);
    return detail ?? null;
  }

  async findTranslationByTagAndLocale(tagId: number, locale: ArticleLocale): Promise<TagTranslation | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<TagTranslationRow[]>(
      `SELECT ${tagTranslationColumns} FROM tag_translations WHERE tag_id = ? AND locale = ? LIMIT 1`,
      [tagId, locale]
    );

    return rows[0] ? mapTagTranslationRow(rows[0]) : null;
  }

  async findTranslationByLocaleAndSlug(locale: ArticleLocale, slug: string): Promise<TagTranslation | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<TagTranslationRow[]>(
      `SELECT ${tagTranslationColumns} FROM tag_translations WHERE locale = ? AND slug = ? LIMIT 1`,
      [locale, slug]
    );

    return rows[0] ? mapTagTranslationRow(rows[0]) : null;
  }

  async createTranslation(input: TagTranslationInput): Promise<TagTranslation> {
    const pool = getDatabasePool();
    await pool.execute(
      "INSERT INTO tag_translations (tag_id, locale, name, slug) VALUES (?, ?, ?, ?)",
      [input.tagId, input.locale, input.name, input.slug]
    );

    const translation = await this.findTranslationByTagAndLocale(input.tagId, input.locale);

    if (!translation) {
      throw new Error("Created tag translation could not be loaded.");
    }

    return translation;
  }

  async updateTranslation(input: TagTranslationInput): Promise<TagTranslation | null> {
    const pool = getDatabasePool();
    await pool.execute(
      "UPDATE tag_translations SET name = ?, slug = ? WHERE tag_id = ? AND locale = ?",
      [input.name, input.slug, input.tagId, input.locale]
    );

    return this.findTranslationByTagAndLocale(input.tagId, input.locale);
  }

  async deleteTag(id: number): Promise<boolean> {
    const pool = getDatabasePool();
    await pool.execute("DELETE FROM article_tags WHERE tag_id = ?", [id]);
    const [result] = await pool.execute<ResultSetHeader>("DELETE FROM tags WHERE id = ?", [id]);

    return result.affectedRows > 0;
  }

  async replaceArticleTags(articleId: number, tagIds: number[]): Promise<TagDetail[]> {
    const pool = getDatabasePool();
    const uniqueTagIds = [...new Set(tagIds)];

    await pool.execute("DELETE FROM article_tags WHERE article_id = ?", [articleId]);

    if (uniqueTagIds.length > 0) {
      const placeholders = uniqueTagIds.map(() => "(?, ?)").join(", ");
      const params = uniqueTagIds.flatMap((tagId) => [articleId, tagId]);

      await pool.execute(`INSERT INTO article_tags (article_id, tag_id) VALUES ${placeholders}`, params);
    }

    return this.findByArticleId(articleId);
  }

  async findByArticleId(articleId: number): Promise<TagDetail[]> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<TagRow[]>(
      `SELECT t.id, t.created_at
       FROM tags t
       INNER JOIN article_tags article_tag ON article_tag.tag_id = t.id
       WHERE article_tag.article_id = ?
       ORDER BY t.id ASC`,
      [articleId]
    );
    const tags = rows.map(mapTagRow);

    return this.attachTranslations(tags);
  }

  private async attachTranslations(tags: Tag[]): Promise<TagDetail[]> {
    if (tags.length === 0) {
      return [];
    }

    const translations = await this.listTranslationsByTagIds(tags.map((tag) => tag.id));

    return groupTranslations(tags, translations);
  }

  private async listTranslationsByTagIds(tagIds: number[]): Promise<TagTranslation[]> {
    const pool = getDatabasePool();
    const placeholders = tagIds.map(() => "?").join(", ");
    const [rows] = await pool.execute<TagTranslationRow[]>(
      `SELECT ${tagTranslationColumns}
       FROM tag_translations
       WHERE tag_id IN (${placeholders})
       ORDER BY tag_id ASC, locale ASC`,
      tagIds
    );

    return rows.map(mapTagTranslationRow);
  }
}
