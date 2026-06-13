import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import type { ArticleLocale } from "../articles/articles.types.js";
import { getDatabasePool } from "../database/connection.js";

export type Category = {
  id: number;
  parentId: number | null;
  createdAt: Date;
};

export type CategoryTranslation = {
  categoryId: number;
  locale: ArticleLocale;
  name: string;
  slug: string;
};

export type CategoryDetail = {
  category: Category;
  translations: CategoryTranslation[];
};

export type CategoryTranslationInput = {
  categoryId: number;
  locale: ArticleLocale;
  name: string;
  slug: string;
};

type CategoryRow = RowDataPacket & {
  id: number;
  parent_id: number | null;
  created_at: Date;
};

type CategoryTranslationRow = RowDataPacket & {
  category_id: number;
  locale: ArticleLocale;
  name: string;
  slug: string;
};

const categoryColumns = ["id", "parent_id", "created_at"].join(", ");
const categoryTranslationColumns = ["category_id", "locale", "name", "slug"].join(", ");

function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    parentId: row.parent_id,
    createdAt: row.created_at
  };
}

function mapCategoryTranslationRow(row: CategoryTranslationRow): CategoryTranslation {
  return {
    categoryId: row.category_id,
    locale: row.locale,
    name: row.name,
    slug: row.slug
  };
}

function groupTranslations(categories: Category[], translations: CategoryTranslation[]): CategoryDetail[] {
  const translationsByCategoryId = new Map<number, CategoryTranslation[]>();

  for (const translation of translations) {
    const current = translationsByCategoryId.get(translation.categoryId) ?? [];
    current.push(translation);
    translationsByCategoryId.set(translation.categoryId, current);
  }

  return categories.map((category) => ({
    category,
    translations: translationsByCategoryId.get(category.id) ?? []
  }));
}

export class CategoryRepository {
  async createCategory(parentId: number | null = null): Promise<Category> {
    const pool = getDatabasePool();
    const [result] = await pool.execute<ResultSetHeader>("INSERT INTO categories (parent_id) VALUES (?)", [parentId]);
    const category = await this.findById(result.insertId);

    if (!category) {
      throw new Error("Created category could not be loaded.");
    }

    return category;
  }

  async listCategories(): Promise<CategoryDetail[]> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<CategoryRow[]>(
      `SELECT ${categoryColumns} FROM categories ORDER BY created_at DESC, id DESC`
    );
    const categories = rows.map(mapCategoryRow);

    return this.attachTranslations(categories);
  }

  async findById(id: number): Promise<Category | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<CategoryRow[]>(
      `SELECT ${categoryColumns} FROM categories WHERE id = ? LIMIT 1`,
      [id]
    );

    return rows[0] ? mapCategoryRow(rows[0]) : null;
  }

  async findDetailById(id: number): Promise<CategoryDetail | null> {
    const category = await this.findById(id);

    if (!category) {
      return null;
    }

    const [detail] = await this.attachTranslations([category]);
    return detail ?? null;
  }

  async findTranslationByCategoryAndLocale(
    categoryId: number,
    locale: ArticleLocale
  ): Promise<CategoryTranslation | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<CategoryTranslationRow[]>(
      `SELECT ${categoryTranslationColumns} FROM category_translations WHERE category_id = ? AND locale = ? LIMIT 1`,
      [categoryId, locale]
    );

    return rows[0] ? mapCategoryTranslationRow(rows[0]) : null;
  }

  async findTranslationByLocaleAndSlug(locale: ArticleLocale, slug: string): Promise<CategoryTranslation | null> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<CategoryTranslationRow[]>(
      `SELECT ${categoryTranslationColumns} FROM category_translations WHERE locale = ? AND slug = ? LIMIT 1`,
      [locale, slug]
    );

    return rows[0] ? mapCategoryTranslationRow(rows[0]) : null;
  }

  async createTranslation(input: CategoryTranslationInput): Promise<CategoryTranslation> {
    const pool = getDatabasePool();
    await pool.execute(
      "INSERT INTO category_translations (category_id, locale, name, slug) VALUES (?, ?, ?, ?)",
      [input.categoryId, input.locale, input.name, input.slug]
    );

    const translation = await this.findTranslationByCategoryAndLocale(input.categoryId, input.locale);

    if (!translation) {
      throw new Error("Created category translation could not be loaded.");
    }

    return translation;
  }

  async updateTranslation(input: CategoryTranslationInput): Promise<CategoryTranslation | null> {
    const pool = getDatabasePool();
    await pool.execute(
      "UPDATE category_translations SET name = ?, slug = ? WHERE category_id = ? AND locale = ?",
      [input.name, input.slug, input.categoryId, input.locale]
    );

    return this.findTranslationByCategoryAndLocale(input.categoryId, input.locale);
  }

  async deleteCategory(id: number): Promise<boolean> {
    const pool = getDatabasePool();
    await pool.execute("DELETE FROM article_categories WHERE category_id = ?", [id]);
    const [result] = await pool.execute<ResultSetHeader>("DELETE FROM categories WHERE id = ?", [id]);

    return result.affectedRows > 0;
  }

  async setArticleCategory(articleId: number, categoryId: number): Promise<CategoryDetail | null> {
    const pool = getDatabasePool();
    await pool.execute(
      `INSERT INTO article_categories (article_id, category_id)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE category_id = VALUES(category_id)`,
      [articleId, categoryId]
    );

    return this.findDetailById(categoryId);
  }

  private async attachTranslations(categories: Category[]): Promise<CategoryDetail[]> {
    if (categories.length === 0) {
      return [];
    }

    const translations = await this.listTranslationsByCategoryIds(categories.map((category) => category.id));

    return groupTranslations(categories, translations);
  }

  private async listTranslationsByCategoryIds(categoryIds: number[]): Promise<CategoryTranslation[]> {
    const pool = getDatabasePool();
    const placeholders = categoryIds.map(() => "?").join(", ");
    const [rows] = await pool.execute<CategoryTranslationRow[]>(
      `SELECT ${categoryTranslationColumns}
       FROM category_translations
       WHERE category_id IN (${placeholders})
       ORDER BY category_id ASC, locale ASC`,
      categoryIds
    );

    return rows.map(mapCategoryTranslationRow);
  }
}
