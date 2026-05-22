import { ArticleContentStatus, type ArticleContent } from "@prisma/client";
import { createHash } from "crypto";

export const articleContentLocales = ["zh-CN", "en-US"] as const;
export type ArticleContentLocale = typeof articleContentLocales[number];

export function normalizeArticleContentLocale(value: unknown): ArticleContentLocale {
  const lower = String(value ?? "").trim().toLowerCase();
  return lower.startsWith("en") ? "en-US" : "zh-CN";
}

export function otherArticleContentLocale(locale: ArticleContentLocale): ArticleContentLocale {
  return locale === "zh-CN" ? "en-US" : "zh-CN";
}

export function contentLocaleLabel(locale: ArticleContentLocale, displayLocale: "zh-CN" | "en" = "zh-CN") {
  if (displayLocale === "en") {
    return locale === "zh-CN" ? "Chinese" : "English";
  }
  return locale === "zh-CN" ? "中文" : "英文";
}

export function hashArticleContent(input: { title: string; summary: string | null; contentHtml: string }) {
  return createHash("sha256")
    .update(JSON.stringify({
      title: input.title,
      summary: input.summary ?? "",
      contentHtml: input.contentHtml
    }))
    .digest("hex");
}

export type ArticleContentLike = Pick<
  ArticleContent,
  | "locale"
  | "title"
  | "summary"
  | "contentHtml"
  | "contentJson"
  | "seoTitle"
  | "seoDescription"
  | "contentStatus"
  | "contentHash"
  | "generatedFromLocale"
  | "generatedAt"
  | "error"
  | "updatedAt"
>;

export function hasArticleContentBody(content: Pick<ArticleContentLike, "title" | "contentHtml"> | null | undefined) {
  return Boolean(content?.title.trim() || content?.contentHtml.trim());
}

export function isDisplayableArticleContent(content: ArticleContentLike | null | undefined) {
  return Boolean(
    content &&
    (content.contentStatus === ArticleContentStatus.READY || content.contentStatus === ArticleContentStatus.STALE) &&
    hasArticleContentBody(content)
  );
}

export function findArticleContent(
  contents: ArticleContentLike[] | null | undefined,
  locale: ArticleContentLocale
) {
  return contents?.find((content) => normalizeArticleContentLocale(content.locale) === locale) ?? null;
}

export type ArticleContentDisplaySource = {
  title: string;
  summary: string | null;
  contentHtml: string;
  sourceLocale?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  contents?: ArticleContentLike[];
};

export function resolveArticleContentDisplay(
  article: ArticleContentDisplaySource,
  locale?: string | null
) {
  const requestedLocale = locale
    ? normalizeArticleContentLocale(locale)
    : normalizeArticleContentLocale(article.sourceLocale);
  const requestedContent = findArticleContent(article.contents, requestedLocale);
  const fallbackLocale = otherArticleContentLocale(requestedLocale);
  const fallbackContent = findArticleContent(article.contents, fallbackLocale);
  const selectedContent = isDisplayableArticleContent(requestedContent)
    ? requestedContent
    : isDisplayableArticleContent(fallbackContent)
      ? fallbackContent
      : null;

  if (selectedContent) {
    return {
      title: selectedContent.title,
      summary: selectedContent.summary,
      contentHtml: selectedContent.contentHtml,
      contentJson: selectedContent.contentJson,
      seoTitle: selectedContent.seoTitle ?? null,
      seoDescription: selectedContent.seoDescription ?? null,
      locale: normalizeArticleContentLocale(selectedContent.locale),
      requestedLocale,
      contentStatus: selectedContent.contentStatus,
      status: normalizeArticleContentLocale(selectedContent.locale) === requestedLocale ? null : ("fallback" as const),
      error: selectedContent.error ?? null
    };
  }

  return {
    title: article.title,
    summary: article.summary,
    contentHtml: article.contentHtml,
    contentJson: null,
    seoTitle: article.seoTitle ?? null,
    seoDescription: article.seoDescription ?? null,
    locale: normalizeArticleContentLocale(article.sourceLocale),
    requestedLocale,
    contentStatus: null as ArticleContentStatus | null,
    status: "fallback" as const,
    error: "Requested article content is unavailable."
  };
}
