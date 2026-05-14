import { Prisma, TranslationStatus } from "@prisma/client";
import { createHash } from "crypto";
import { db, isDatabaseConfigured } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { assertPermission, canManageArticles } from "@/lib/permissions";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import { getTranslationConfig, callTranslationApi } from "@/features/settings/translation-settings";

export function hashArticleSource(input: { title: string; summary: string | null; contentHtml: string }) {
  return createHash("sha256")
    .update(JSON.stringify({
      title: input.title,
      summary: input.summary ?? "",
      contentHtml: input.contentHtml
    }))
    .digest("hex");
}

function normalizeLocale(value: string) {
  const lower = value.toLowerCase();
  if (lower.startsWith("en")) {
    return "en";
  }
  if (lower.startsWith("zh")) {
    return "zh-CN";
  }
  return value || "en";
}

export type ArticleTranslationDisplaySource = {
  title: string;
  summary: string | null;
  contentHtml: string;
  translations: Array<{
    locale: string;
    title: string;
    summary: string | null;
    contentHtml: string;
    status: TranslationStatus;
    contentHash: string | null;
    error?: string | null;
  }>;
};

type ArticleTranslationSource = {
  id: string;
  title: string;
  summary: string | null;
  contentHtml: string;
  contentJson?: unknown;
  updatedAt: Date;
};

export function resolveArticleDisplayTranslation(
  article: ArticleTranslationDisplaySource,
  locale?: string | null
) {
  const normalizedLocale = locale ? normalizeLocale(locale) : null;
  const sourceHash = hashArticleSource({
    title: article.title,
    summary: article.summary,
    contentHtml: article.contentHtml
  });

  if (!normalizedLocale || normalizedLocale === "zh-CN") {
    return {
      title: article.title,
      summary: article.summary,
      contentHtml: article.contentHtml,
      locale: normalizedLocale,
      status: null as "translated" | "fallback" | null,
      error: null as string | null
    };
  }

  const translation = article.translations.find((item) => item.locale === normalizedLocale);
  if (
    translation?.status === TranslationStatus.TRANSLATED &&
    translation.contentHash === sourceHash &&
    translation.contentHtml.trim()
  ) {
    return {
      title: translation.title,
      summary: translation.summary,
      contentHtml: translation.contentHtml,
      locale: normalizedLocale,
      status: "translated" as const,
      error: null as string | null
    };
  }

  return {
    title: article.title,
    summary: article.summary,
    contentHtml: article.contentHtml,
    locale: normalizedLocale,
    status: "fallback" as const,
    error:
      translation?.error ??
      (translation?.contentHash && translation.contentHash !== sourceHash
        ? "译文已过期，正在等待重新生成。"
        : "该语言译文尚未生成。")
  };
}

export async function isTranslationConfigured() {
  const config = await getTranslationConfig();
  return config.isConfigured;
}

export async function listArticleTranslations(user: CurrentUser, articleId: string) {
  assertPermission(canManageArticles(user), "You do not have permission to view article translations.");

  if (!isDatabaseConfigured()) {
    return [];
  }

  return db.articleTranslation.findMany({
    where: { articleId },
    orderBy: { updatedAt: "desc" }
  });
}

async function markTranslationInProgress(article: ArticleTranslationSource, locale: string, contentHash: string) {
  await db.articleTranslation.upsert({
    where: { articleId_locale: { articleId: article.id, locale } },
    update: {
      title: article.title,
      summary: article.summary,
      contentHtml: article.contentHtml,
      contentJson: (article.contentJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      status: TranslationStatus.TRANSLATING,
      error: null,
      contentHash,
      sourceUpdatedAt: article.updatedAt,
      translatedAt: null
    },
    create: {
      articleId: article.id,
      locale,
      title: article.title,
      summary: article.summary,
      contentHtml: article.contentHtml,
      contentJson: (article.contentJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      status: TranslationStatus.TRANSLATING,
      error: null,
      contentHash,
      sourceUpdatedAt: article.updatedAt
    }
  });
}

export async function translateArticle(user: CurrentUser, articleId: string, targetLocale: string) {
  assertPermission(canManageArticles(user), "You do not have permission to translate articles.");

  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const config = await getTranslationConfig();
  if (!config.enabled) {
    throw new Error("Translation is disabled.");
  }
  if (!config.isConfigured) {
    throw new Error("Translation API is not configured.");
  }

  const locale = normalizeLocale(targetLocale);
  const article = await db.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      title: true,
      summary: true,
      contentHtml: true,
      contentJson: true,
      updatedAt: true
    }
  });

  if (!article) {
    throw new Error("Article not found.");
  }

  const contentHash = hashArticleSource(article);
  const existing = await db.articleTranslation.findUnique({
    where: { articleId_locale: { articleId, locale } }
  });

  if (
    existing?.status === TranslationStatus.TRANSLATED &&
    existing.contentHash === contentHash
  ) {
    return existing;
  }

  await markTranslationInProgress(article, locale, contentHash);

  try {
    const translated = await callTranslationApi(config, {
      title: article.title,
      summary: article.summary,
      contentHtml: article.contentHtml,
      targetLocale: locale
    });

    await db.articleTranslation.update({
      where: { articleId_locale: { articleId, locale } },
      data: {
        ...translated,
        contentJson: Prisma.JsonNull,
        status: TranslationStatus.TRANSLATED,
        error: null,
        contentHash,
        sourceUpdatedAt: article.updatedAt,
        translatedAt: new Date()
      }
    });
  } catch (error) {
    await db.articleTranslation.update({
      where: { articleId_locale: { articleId, locale } },
      data: {
        status: TranslationStatus.FAILED,
        error: error instanceof Error ? error.message : "Translation failed.",
        contentHash,
        sourceUpdatedAt: article.updatedAt
      }
    });
    throw error;
  }
}

const scheduledArticleTranslationSync = new Set<string>();

export function scheduleArticleTranslationSync(article: ArticleTranslationSource) {
  if (scheduledArticleTranslationSync.has(article.id)) {
    return;
  }

  scheduledArticleTranslationSync.add(article.id);
  setTimeout(() => {
    syncArticleTranslationsAfterSourceChange(article)
      .catch((error) => {
        console.error("Article background translation sync failed", error);
      })
      .finally(() => {
        scheduledArticleTranslationSync.delete(article.id);
      });
  }, 0);
}

export async function syncArticleTranslationsAfterSourceChange(article: ArticleTranslationSource) {
  if (!isDatabaseConfigured()) {
    return;
  }

  const contentHash = hashArticleSource(article);
  const existingTranslations = await db.articleTranslation.findMany({
    where: { articleId: article.id },
    select: {
      locale: true,
      status: true,
      contentHash: true
    }
  });
  const staleLocales = existingTranslations
    .filter((translation) => translation.contentHash !== contentHash)
    .map((translation) => translation.locale);

  if (staleLocales.length) {
    await db.articleTranslation.updateMany({
      where: {
        articleId: article.id,
        locale: { in: staleLocales }
      },
      data: {
        title: article.title,
        summary: article.summary,
        contentHtml: article.contentHtml,
        contentJson: (article.contentJson ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        status: TranslationStatus.NOT_TRANSLATED,
        error: null,
        contentHash,
        sourceUpdatedAt: article.updatedAt,
        translatedAt: null
      }
    });
  }

  const config = await getTranslationConfig().catch((error) => {
    console.error("Failed to load translation config after article source change", error);
    return null;
  });

  if (!config?.enabled || !config.isConfigured || !config.autoTranslate || !config.saveResult) {
    return;
  }

  const locale = normalizeLocale(config.targetLang);
  if (normalizeLocale(config.sourceLang) === locale) {
    return;
  }

  const currentTarget = existingTranslations.find((translation) => translation.locale === locale);
  if (currentTarget?.status === TranslationStatus.TRANSLATED && currentTarget.contentHash === contentHash) {
    return;
  }

  await markTranslationInProgress(article, locale, contentHash);

  try {
    const translated = await callTranslationApi(config, {
      title: article.title,
      summary: article.summary,
      contentHtml: article.contentHtml,
      targetLocale: locale
    });

    await db.articleTranslation.update({
      where: { articleId_locale: { articleId: article.id, locale } },
      data: {
        ...translated,
        contentJson: Prisma.JsonNull,
        status: TranslationStatus.TRANSLATED,
        error: null,
        contentHash,
        sourceUpdatedAt: article.updatedAt,
        translatedAt: new Date()
      }
    });
  } catch (error) {
    await db.articleTranslation.update({
      where: { articleId_locale: { articleId: article.id, locale } },
      data: {
        status: TranslationStatus.FAILED,
        error: error instanceof Error ? error.message : "Translation failed.",
        contentHash,
        sourceUpdatedAt: article.updatedAt
      }
    });
    console.error("Article translation sync failed", error);
  }
}

export async function upsertManualArticleTranslation(
  user: CurrentUser,
  input: {
    articleId: string;
    locale: string;
    title: string;
    summary?: string | null;
    contentHtml: string;
    contentJson: unknown;
  }
) {
  assertPermission(canManageArticles(user), "You do not have permission to edit article translations.");

  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const article = await db.article.findUnique({
    where: { id: input.articleId },
    select: {
      id: true,
      title: true,
      summary: true,
      contentHtml: true,
      updatedAt: true
    }
  });

  if (!article) {
    throw new Error("Article not found.");
  }

  const locale = normalizeLocale(input.locale);
  const contentHash = hashArticleSource(article);
  const sanitizedHtml = sanitizeArticleHtml(input.contentHtml);

  return db.articleTranslation.upsert({
    where: { articleId_locale: { articleId: article.id, locale } },
    update: {
      title: input.title.trim(),
      summary: input.summary?.trim() || null,
      contentHtml: sanitizedHtml,
      contentJson: input.contentJson as Prisma.InputJsonValue,
      status: TranslationStatus.TRANSLATED,
      error: null,
      contentHash,
      sourceUpdatedAt: article.updatedAt,
      translatedAt: new Date()
    },
    create: {
      articleId: article.id,
      locale,
      title: input.title.trim(),
      summary: input.summary?.trim() || null,
      contentHtml: sanitizedHtml,
      contentJson: input.contentJson as Prisma.InputJsonValue,
      status: TranslationStatus.TRANSLATED,
      error: null,
      contentHash,
      sourceUpdatedAt: article.updatedAt,
      translatedAt: new Date()
    }
  });
}

export async function deleteArticleTranslationsForSource(articleId: string) {
  if (!isDatabaseConfigured()) {
    return;
  }

  await db.articleTranslation.deleteMany({
    where: { articleId }
  });
}
