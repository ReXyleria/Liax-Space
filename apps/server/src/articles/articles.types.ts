export type ArticleStatus = string;
export type ArticleLocale = "zh-CN" | "en-US";

export const articleLocales = ["zh-CN", "en-US"] as const;

export function isArticleLocale(value: unknown): value is ArticleLocale {
  return typeof value === "string" && articleLocales.includes(value as ArticleLocale);
}

export type Article = {
  id: number;
  authorId: number;
  status: ArticleStatus;
  coverAttachmentId: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type CreateArticleInput = {
  authorId: number;
  status?: ArticleStatus;
  coverAttachmentId?: number | null;
};

export type UpdateArticleInput = {
  id: number;
  status?: ArticleStatus;
  coverAttachmentId?: number | null;
};

export type ListArticlesInput = {
  status?: ArticleStatus;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
};

export type ArticleTranslation = {
  id: number;
  articleId: number;
  locale: ArticleLocale;
  title: string;
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  summary: string | null;
  currentVersionId: number | null;
  publishedVersionId: number | null;
  currentHtmlPath: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  allowedRoles: string[];
};

export type CreateArticleTranslationInput = {
  articleId: number;
  allowedRoles?: string[];
  locale: ArticleLocale;
  title: string;
  slug: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  summary?: string | null;
};

export type UpdateArticleTranslationInput = {
  articleId: number;
  allowedRoles?: string[];
  locale: ArticleLocale;
  title?: string;
  slug?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  summary?: string | null;
  publishedAt?: Date;
};

export type UpdateCurrentVersionInput = {
  articleId: number;
  locale: ArticleLocale;
  currentVersionId: number | null;
};

export type UpdatePublishedVersionInput = {
  articleId: number;
  locale: ArticleLocale;
  publishedVersionId: number | null;
  currentHtmlPath: string | null;
  publishedAt?: Date | null;
  allowedRoles?: string[];
};

export type ListTranslationsInput = {
  articleId?: number;
  locale?: ArticleLocale;
};
