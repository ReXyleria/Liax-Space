import { ArticleStatus, type ArticleContentStatus } from "@prisma/client";
import {
  findArticleContent,
  hasArticleContentBody,
  isDisplayableArticleContent,
  normalizeArticleContentLocale,
  type ArticleContentLike,
  type ArticleContentLocale
} from "@/features/articles/content-service";
import { localizedPath, urlLocales } from "@/lib/locale-url";

export type IndexableArticleLike = {
  slug: string;
  title: string;
  contentHtml: string;
  status: ArticleStatus;
  deletedAt: Date | string | null;
  sourceLocale?: string | null;
  contents?: Array<ArticleContentLike | {
    locale: string;
    title: string;
    contentHtml: string;
    contentStatus: ArticleContentStatus;
  }>;
};

export function isIndexableArticleLocale(article: IndexableArticleLike, locale: ArticleContentLocale) {
  if (article.status !== ArticleStatus.PUBLISHED || article.deletedAt) {
    return false;
  }

  const sourceLocale = normalizeArticleContentLocale(article.sourceLocale);
  const content = findArticleContent(article.contents as ArticleContentLike[] | undefined, locale);
  if (isDisplayableArticleContent(content)) {
    return true;
  }

  return locale === sourceLocale && hasArticleContentBody(article);
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
