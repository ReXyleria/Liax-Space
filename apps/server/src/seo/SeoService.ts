import type { RowDataPacket } from "mysql2/promise";

import type { ArticleLocale, ArticleTranslation } from "../articles/articles.types.js";
import { getDatabasePool } from "../database/connection.js";
import { env } from "../config/env.js";
import type { HreflangAlternate } from "../renderer/renderer.types.js";

export type PublicLocalePrefix = "zh" | "en";

export type PublishedArticleSeo = {
  articleId: number;
  locale: ArticleLocale;
  title: string;
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  summary: string | null;
  updatedAt: Date;
  publishedAt: Date;
};

export type ArticleSeoMeta = {
  title: string;
  description: string | null;
  canonicalUrl: string;
  alternates: HreflangAlternate[];
};

type PublishedArticleSeoRow = RowDataPacket & {
  article_id: number;
  locale: ArticleLocale;
  title: string;
  slug: string;
  seo_title: string | null;
  seo_description: string | null;
  summary: string | null;
  updated_at: Date;
  published_at: Date;
};

const publishedArticleColumns = [
  "article_translations.article_id",
  "article_translations.locale",
  "article_translations.title",
  "article_translations.slug",
  "article_translations.seo_title",
  "article_translations.seo_description",
  "article_translations.summary",
  "article_translations.updated_at",
  "article_translations.published_at"
].join(", ");

const publicVisibilityWhere = "JSON_LENGTH(COALESCE(article_translations.allowed_roles_json, JSON_ARRAY())) = 0";

const localeToPrefixMap: Record<ArticleLocale, PublicLocalePrefix> = {
  "en-US": "en",
  "zh-CN": "zh"
};

const prefixToLocaleMap: Record<PublicLocalePrefix, ArticleLocale> = {
  en: "en-US",
  zh: "zh-CN"
};

function mapPublishedArticleSeoRow(row: PublishedArticleSeoRow): PublishedArticleSeo {
  return {
    articleId: row.article_id,
    locale: row.locale,
    title: row.title,
    slug: row.slug,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    summary: row.summary,
    updatedAt: row.updated_at,
    publishedAt: row.published_at
  };
}

function trimToNull(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function localeToPublicPrefix(locale: ArticleLocale): PublicLocalePrefix {
  return localeToPrefixMap[locale];
}

export function publicPrefixToLocale(prefix: PublicLocalePrefix): ArticleLocale {
  return prefixToLocaleMap[prefix];
}

export class SeoService {
  async listPublishedArticles(locale?: ArticleLocale): Promise<PublishedArticleSeo[]> {
    const pool = getDatabasePool();
    const params: string[] = [];
    const localeFilter = locale === undefined ? "" : " AND article_translations.locale = ?";

    if (locale !== undefined) {
      params.push(locale);
    }

    const [rows] = await pool.execute<PublishedArticleSeoRow[]>(
      `SELECT ${publishedArticleColumns}
       FROM article_translations
       INNER JOIN articles ON articles.id = article_translations.article_id
       WHERE articles.deleted_at IS NULL
         AND article_translations.published_version_id IS NOT NULL
         AND article_translations.current_html_path IS NOT NULL
         AND article_translations.published_at IS NOT NULL
         AND ${publicVisibilityWhere}${localeFilter}
       ORDER BY article_translations.published_at DESC, article_translations.article_id DESC`,
      params
    );

    return rows.map(mapPublishedArticleSeoRow);
  }

  async buildArticleMeta(article: PublishedArticleSeo): Promise<ArticleSeoMeta> {
    return {
      alternates: await this.buildAlternateLinks(article.articleId),
      canonicalUrl: this.buildArticleUrl(article.locale, article.slug),
      description: trimToNull(article.seoDescription) ?? trimToNull(article.summary),
      title: trimToNull(article.seoTitle) ?? article.title
    };
  }

  async buildArticleMetaFromTranslation(translation: ArticleTranslation): Promise<ArticleSeoMeta> {
    const canonicalUrl = this.buildArticleUrl(translation.locale, translation.slug);
    const alternates = await this.buildAlternateLinks(translation.articleId);

    if (!alternates.some((alternate) => alternate.hreflang === translation.locale)) {
      alternates.push({
        href: canonicalUrl,
        hreflang: translation.locale
      });
    }

    return {
      alternates,
      canonicalUrl,
      description: trimToNull(translation.seoDescription) ?? trimToNull(translation.summary),
      title: trimToNull(translation.seoTitle) ?? translation.title
    };
  }

  async buildAlternateLinks(articleId: number): Promise<HreflangAlternate[]> {
    const articles = await this.listPublishedArticlesByArticleId(articleId);

    return articles.map((article) => ({
      href: this.buildArticleUrl(article.locale, article.slug),
      hreflang: article.locale
    }));
  }

  buildArticleUrl(locale: ArticleLocale, slug: string): string {
    return `${env.publicBaseUrl}/${localeToPublicPrefix(locale)}/posts/${encodeURIComponent(slug)}`;
  }

  buildLocaleHomeUrl(locale: ArticleLocale): string {
    return `${env.publicBaseUrl}/${localeToPublicPrefix(locale)}`;
  }

  buildSitemapIndexUrl(): string {
    return `${env.publicBaseUrl}/sitemap.xml`;
  }

  buildLocaleSitemapUrl(locale: ArticleLocale): string {
    return `${env.publicBaseUrl}/${localeToPublicPrefix(locale)}/sitemap.xml`;
  }

  buildLocaleRssUrl(locale: ArticleLocale): string {
    return `${env.publicBaseUrl}/${localeToPublicPrefix(locale)}/rss.xml`;
  }

  private async listPublishedArticlesByArticleId(articleId: number): Promise<PublishedArticleSeo[]> {
    const pool = getDatabasePool();
    const [rows] = await pool.execute<PublishedArticleSeoRow[]>(
      `SELECT ${publishedArticleColumns}
       FROM article_translations
       INNER JOIN articles ON articles.id = article_translations.article_id
       WHERE articles.id = ?
         AND articles.deleted_at IS NULL
         AND article_translations.published_version_id IS NOT NULL
         AND article_translations.current_html_path IS NOT NULL
         AND article_translations.published_at IS NOT NULL
         AND ${publicVisibilityWhere}
       ORDER BY article_translations.locale ASC`,
      [articleId]
    );

    return rows.map(mapPublishedArticleSeoRow);
  }
}
