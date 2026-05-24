import { ArticleStatus, type ArticleContentStatus } from "@prisma/client";
import {
  hasArticleContentBody,
  normalizeArticleContentLocale,
  type ArticleContentLocale
} from "@/features/articles/content-service";
import { localizedPath, urlLocales } from "@/lib/locale-url";

export type IndexableArticleLike = {
  slug: string;
  title: string;
  contentHtml?: string | null;
  status: ArticleStatus;
  deletedAt: Date | string | null;
  sourceLocale?: string | null;
  contents?: Array<{
    locale: string;
    title: string;
    contentHtml?: string | null;
    contentStatus: ArticleContentStatus;
  }>;
};
type IndexableArticleContent = NonNullable<IndexableArticleLike["contents"]>[number];

function findIndexableContent(article: IndexableArticleLike, locale: ArticleContentLocale) {
  return article.contents?.find((content) => normalizeArticleContentLocale(content.locale) === locale) ?? null;
}

function isDisplayableIndexableContent(content: IndexableArticleContent | null | undefined) {
  return Boolean(
    content &&
    (content.contentStatus === "READY" || content.contentStatus === "STALE") &&
    hasArticleContentBody({ title: content.title, contentHtml: content.contentHtml ?? "" })
  );
}

export function isIndexableArticleLocale(article: IndexableArticleLike, locale: ArticleContentLocale) {
  if (article.status !== ArticleStatus.PUBLISHED || article.deletedAt) {
    return false;
  }

  const sourceLocale = normalizeArticleContentLocale(article.sourceLocale);
  const content = findIndexableContent(article, locale);
  if (isDisplayableIndexableContent(content)) {
    return true;
  }

  return locale === sourceLocale && hasArticleContentBody({ title: article.title, contentHtml: article.contentHtml ?? "" });
}

export function getIndexableArticleLocales(article: IndexableArticleLike) {
  return urlLocales.filter((locale) => isIndexableArticleLocale(article, locale));
}

export function getIndexableArticleLocaleUrls(article: IndexableArticleLike, siteUrl: string) {
  return getIndexableArticleLocales(article).map((locale) => ({
    locale,
    url: `${siteUrl}${localizedPath(locale, `/articles/${article.slug}`)}`
  }));
}
