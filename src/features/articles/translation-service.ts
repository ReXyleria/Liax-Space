import { ArticleContentStatus, Prisma, TranslationStatus } from "@prisma/client";
import { db, isDatabaseConfigured } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { assertPermission, canManageArticles } from "@/lib/permissions";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import {
  callTranslationApi,
  getTranslationConfig,
  requestTranslationApi,
  splitHtmlIntoChunks,
  type TranslationProgressUpdate
} from "@/features/settings/translation-settings";
import { localeToUrlLocale } from "@/lib/locale-url";
import {
  articleContentLocales,
  findArticleContent,
  hasArticleContentBody,
  hashArticleContent,
  isDisplayableArticleContent,
  normalizeArticleContentLocale,
  otherArticleContentLocale,
  resolveArticleContentDisplay,
  type ArticleContentLike,
  type ArticleContentDisplaySource,
  type ArticleContentLocale
} from "@/features/articles/content-service";
import { pushArticleUrlAfterPublish } from "@/features/site-push/service";

export const articleLanguageLocales = articleContentLocales;
export type ArticleLanguageLocale = ArticleContentLocale;
export type ArticleTranslationDisplaySource = ArticleContentDisplaySource;

export function hashArticleSource(input: { title: string; summary: string | null; contentHtml: string }) {
  return hashArticleContent(input);
}

export function normalizeTranslationLocale(value: string) {
  return normalizeArticleContentLocale(value);
}

export function normalizeArticleLanguageLocale(value: unknown): ArticleLanguageLocale {
  return normalizeArticleContentLocale(value);
}

export function resolveArticleDisplayTranslation(
  article: ArticleTranslationDisplaySource,
  locale?: string | null,
  options?: { allowFallback?: boolean }
) {
  return resolveArticleContentDisplay(article, locale ? localeToUrlLocale(locale) : locale, options);
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

  return db.articleContent.findMany({
    where: { articleId },
    orderBy: { updatedAt: "desc" }
  });
}

export async function getArticleTranslationProgress(user: CurrentUser, articleId: string, targetLocale: string) {
  assertPermission(canManageArticles(user), "You do not have permission to view article translation progress.");

  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const locale = normalizeArticleContentLocale(targetLocale);
  return db.articleTranslationJob.findFirst({
    where: { articleId, locale },
    orderBy: { createdAt: "desc" },
    select: {
      articleId: true,
      locale: true,
      status: true,
      progress: true,
      completedUnits: true,
      totalUnits: true,
      progressMessage: true,
      error: true,
      updatedAt: true
    }
  });
}

function selectSourceContent(
  contents: ArticleContentLike[],
  targetLocale: ArticleContentLocale,
  articleSourceLocale: ArticleContentLocale
) {
  const preferredSourceLocale = otherArticleContentLocale(targetLocale);
  const preferred = findArticleContent(contents, preferredSourceLocale);
  if (isDisplayableArticleContent(preferred)) {
    return preferred;
  }

  if (articleSourceLocale !== targetLocale) {
    const articleSource = findArticleContent(contents, articleSourceLocale);
    if (isDisplayableArticleContent(articleSource)) {
      return articleSource;
    }
  }

  return contents.find((content) => (
    normalizeArticleContentLocale(content.locale) !== targetLocale &&
    isDisplayableArticleContent(content)
  )) ?? null;
}

async function ensureEmptyTargetPlaceholder(articleId: string, locale: ArticleContentLocale) {
  await db.articleContent.upsert({
    where: { articleId_locale: { articleId, locale } },
    update: {
      contentStatus: ArticleContentStatus.EMPTY,
      error: null
    },
    create: {
      articleId,
      locale,
      title: "",
      summary: null,
      contentHtml: "",
      contentJson: Prisma.JsonNull,
      contentStatus: ArticleContentStatus.EMPTY,
      error: null
    }
  });
}

async function prepareTranslationChunkRows(
  articleId: string,
  locale: ArticleContentLocale,
  sourceHash: string,
  chunks: string[]
) {
  const existing = await db.articleTranslationChunk.findMany({
    where: { articleId, locale, sourceHash },
    orderBy: { chunkIndex: "asc" }
  });
  const chunksMatch =
    existing.length === chunks.length &&
    existing.every((row) => row.sourceHtml === chunks[row.chunkIndex]);

  if (!chunksMatch) {
    await db.articleTranslationChunk.deleteMany({
      where: { articleId, locale, sourceHash }
    });
    if (chunks.length) {
      await db.articleTranslationChunk.createMany({
        data: chunks.map((chunk, chunkIndex) => ({
          articleId,
          locale,
          sourceHash,
          chunkIndex,
          sourceHtml: chunk,
          status: TranslationStatus.NOT_TRANSLATED
        }))
      });
    }
  }

  return db.articleTranslationChunk.findMany({
    where: { articleId, locale, sourceHash },
    orderBy: { chunkIndex: "asc" }
  });
}

async function translatePersistedChunks(
  config: Awaited<ReturnType<typeof getTranslationConfig>>,
  input: {
    articleId: string;
    locale: ArticleContentLocale;
    sourceHash: string;
    chunks: string[];
  },
  onChunkComplete?: (completedChunks: number) => void | Promise<void>
) {
  const rows = await prepareTranslationChunkRows(input.articleId, input.locale, input.sourceHash, input.chunks);
  const results = new Array<string>(input.chunks.length);
  const completedIndexes = new Set<number>();

  for (const row of rows) {
    if (row.status === TranslationStatus.TRANSLATED && row.translatedHtml?.trim()) {
      results[row.chunkIndex] = row.translatedHtml;
      completedIndexes.add(row.chunkIndex);
    }
  }

  let completedChunks = completedIndexes.size;
  await onChunkComplete?.(completedChunks);

  let nextIndex = 0;
  const concurrency = Math.min(4, Math.max(1, config.chunkConcurrency || 2));

  async function worker() {
    while (nextIndex < rows.length) {
      const row = rows[nextIndex];
      nextIndex += 1;

      if (!row || completedIndexes.has(row.chunkIndex)) {
        continue;
      }

      await db.articleTranslationChunk.update({
        where: { id: row.id },
        data: {
          status: TranslationStatus.TRANSLATING,
          error: null
        }
      });

      try {
        const translated = await requestTranslationApi(config, {
          title: `Chunk ${row.chunkIndex + 1}`,
          summary: null,
          contentHtml: row.sourceHtml,
          targetLocale: input.locale,
          purpose: "chunk"
        });
        const translatedHtml = sanitizeArticleHtml(translated.contentHtml);
        results[row.chunkIndex] = translatedHtml;
        completedIndexes.add(row.chunkIndex);
        completedChunks = completedIndexes.size;

        await db.articleTranslationChunk.update({
          where: { id: row.id },
          data: {
            translatedHtml,
            status: TranslationStatus.TRANSLATED,
            error: null,
            translatedAt: new Date()
          }
        });
        await onChunkComplete?.(completedChunks);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        await db.articleTranslationChunk.update({
          where: { id: row.id },
          data: {
            status: TranslationStatus.FAILED,
            error: message
          }
        });
        throw new Error(`Chunk ${row.chunkIndex + 1} translation failed: ${message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, () => worker()));

  const missing = results.findIndex((value) => !value?.trim());
  if (missing >= 0) {
    throw new Error(`Chunk ${missing + 1} translation is incomplete.`);
  }

  return results;
}

async function translateArticleWithPersistentChunks(
  config: Awaited<ReturnType<typeof getTranslationConfig>>,
  input: {
    articleId: string;
    sourceHash: string;
    title: string;
    summary: string | null;
    contentHtml: string;
    targetLocale: ArticleContentLocale;
  },
  onProgress?: (progress: TranslationProgressUpdate) => void | Promise<void>
) {
  const maxChunkChars = Math.max(800, config.maxChunkChars || 3500);
  const chunks = splitHtmlIntoChunks(input.contentHtml, maxChunkChars);
  const totalUnits = chunks.length + 1;

  await onProgress?.({ completedUnits: 0, totalUnits, message: "Preparing translation chunks" });
  const rows = await prepareTranslationChunkRows(input.articleId, input.targetLocale, input.sourceHash, chunks);
  const alreadyTranslated = rows.filter((row) => (
    row.status === TranslationStatus.TRANSLATED && row.translatedHtml?.trim()
  )).length;
  await onProgress?.({
    completedUnits: alreadyTranslated,
    totalUnits,
    message: alreadyTranslated ? `Reusing ${alreadyTranslated}/${chunks.length} translated chunks` : "Translation chunks ready"
  });

  const meta = await requestTranslationApi(config, {
    title: input.title,
    summary: input.summary,
    contentHtml: "",
    targetLocale: input.targetLocale,
    purpose: "meta"
  });
  await onProgress?.({
    completedUnits: alreadyTranslated + 1,
    totalUnits,
    message: "Metadata translated"
  });

  const translatedChunks = await translatePersistedChunks(
    config,
    {
      articleId: input.articleId,
      locale: input.targetLocale,
      sourceHash: input.sourceHash,
      chunks
    },
    async (completedChunks) => {
      await onProgress?.({
        completedUnits: completedChunks + 1,
        totalUnits,
        message: `Translated ${completedChunks}/${chunks.length} content chunks`
      });
    }
  );

  return {
    title: meta.title,
    summary: meta.summary,
    contentHtml: sanitizeArticleHtml(translatedChunks.join(""))
  };
}

export async function executeArticleTranslation(
  articleId: string,
  targetLocale: string,
  onProgress?: (progress: TranslationProgressUpdate) => void | Promise<void>
) {
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

  const locale = normalizeArticleContentLocale(targetLocale);
  const article = await db.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      slug: true,
      sourceLocale: true,
      contents: true
    }
  });

  if (!article) {
    throw new Error("Article not found.");
  }

  const sourceLocale = normalizeArticleContentLocale(article.sourceLocale);
  const sourceContent = selectSourceContent(article.contents, locale, sourceLocale);
  if (!sourceContent) {
    throw new Error("No available source content for translation.");
  }

  const targetContent = findArticleContent(article.contents, locale);
  const targetHasBody = hasArticleContentBody(targetContent);
  const targetHadReadyBody = Boolean(targetContent?.contentStatus === ArticleContentStatus.READY && targetHasBody);
  const targetWasMissingOrEmpty = !targetContent || !targetHasBody;
  const sourceContentHash = hashArticleContent({
    title: sourceContent.title,
    summary: sourceContent.summary,
    contentHtml: sourceContent.contentHtml
  });
  const sourceContentLocale = normalizeArticleContentLocale(sourceContent.locale);

  if (
    targetContent?.contentStatus === ArticleContentStatus.READY &&
    targetContent.generatedFromLocale === sourceContentLocale &&
    targetContent.contentHash === sourceContentHash
  ) {
    await onProgress?.({ completedUnits: 1, totalUnits: 1, message: "Translation already current" });
    return { articleSlug: article.slug };
  }

  if (targetWasMissingOrEmpty) {
    await ensureEmptyTargetPlaceholder(article.id, locale);
  }

  await onProgress?.({ completedUnits: 0, totalUnits: 0, message: "Translation queued" });

  try {
    const maxChunkChars = Math.max(800, config.maxChunkChars || 3500);
    const translated = config.chunkingEnabled && sourceContent.contentHtml.length > maxChunkChars
      ? await translateArticleWithPersistentChunks(
          config,
          {
            articleId: article.id,
            sourceHash: sourceContentHash,
            title: sourceContent.title,
            summary: sourceContent.summary,
            contentHtml: sourceContent.contentHtml,
            targetLocale: locale
          },
          onProgress
        )
      : await callTranslationApi(
          config,
          {
            title: sourceContent.title,
            summary: sourceContent.summary,
            contentHtml: sourceContent.contentHtml,
            targetLocale: locale
          },
          {
            onProgress: async (progress) => {
              await onProgress?.(progress);
            }
          }
        );

    await db.articleContent.upsert({
      where: { articleId_locale: { articleId, locale } },
      update: {
        title: translated.title,
        summary: translated.summary,
        contentHtml: sanitizeArticleHtml(translated.contentHtml),
        contentJson: Prisma.JsonNull,
        seoTitle: null,
        seoDescription: null,
        contentStatus: ArticleContentStatus.READY,
        contentHash: sourceContentHash,
        generatedFromLocale: sourceContentLocale,
        generatedAt: new Date(),
        error: null
      },
      create: {
        articleId,
        locale,
        title: translated.title,
        summary: translated.summary,
        contentHtml: sanitizeArticleHtml(translated.contentHtml),
        contentJson: Prisma.JsonNull,
        seoTitle: null,
        seoDescription: null,
        contentStatus: ArticleContentStatus.READY,
        contentHash: sourceContentHash,
        generatedFromLocale: sourceContentLocale,
        generatedAt: new Date(),
        error: null
      }
    });

    void pushArticleUrlAfterPublish(article.id).catch((error) => {
      console.warn("[site-push] automatic translated article push failed", {
        articleId: article.id,
        locale,
        message: error instanceof Error ? error.message : "Unknown error"
      });
    });

    await onProgress?.({ completedUnits: 1, totalUnits: 1, message: "Translation complete" });
    return { articleSlug: article.slug };
  } catch (error) {
    if (!targetHadReadyBody && targetWasMissingOrEmpty) {
      await db.articleContent.update({
        where: { articleId_locale: { articleId, locale } },
        data: {
          contentStatus: ArticleContentStatus.FAILED,
          error: error instanceof Error ? error.message : "Translation failed."
        }
      });
    }
    throw error;
  }
}

export async function translateArticle(user: CurrentUser, articleId: string, targetLocale: string) {
  assertPermission(canManageArticles(user), "You do not have permission to translate articles.");
  return executeArticleTranslation(articleId, targetLocale);
}

const scheduledArticleTranslationSync = new Set<string>();

export function scheduleArticleTranslationSync(article: { id: string }) {
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

export async function syncArticleTranslationsAfterSourceChange(article: { id: string }) {
  if (!isDatabaseConfigured()) {
    return;
  }

  const config = await getTranslationConfig().catch((error) => {
    console.error("Failed to load translation config after article source change", error);
    return null;
  });

  if (!config?.enabled || !config.isConfigured || !config.autoTranslate || !config.saveResult) {
    return;
  }

  const targetLocale = normalizeArticleContentLocale(config.targetLang);
  await executeArticleTranslation(article.id, targetLocale).catch((error) => {
    console.error("Article translation sync failed", error);
  });
}

export async function upsertManualArticleTranslation(
  user: CurrentUser,
  input: {
    articleId: string;
    locale: string;
    title: string;
    summary?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
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
      slug: true,
      contents: true
    }
  });

  if (!article) {
    throw new Error("Article not found.");
  }

  const locale = normalizeArticleContentLocale(input.locale);
  const sanitizedHtml = sanitizeArticleHtml(input.contentHtml);
  const contentHash = hashArticleContent({
    title: input.title.trim(),
    summary: input.summary?.trim() || null,
    contentHtml: sanitizedHtml
  });
  const previous = findArticleContent(article.contents, locale);

  await db.$transaction(async (tx) => {
    await tx.articleContent.upsert({
      where: { articleId_locale: { articleId: article.id, locale } },
      update: {
        title: input.title.trim(),
        summary: input.summary?.trim() || null,
        seoTitle: input.seoTitle?.trim() || null,
        seoDescription: input.seoDescription?.trim() || null,
        contentHtml: sanitizedHtml,
        contentJson: input.contentJson as Prisma.InputJsonValue,
        contentStatus: ArticleContentStatus.READY,
        contentHash,
        error: null
      },
      create: {
        articleId: article.id,
        locale,
        title: input.title.trim(),
        summary: input.summary?.trim() || null,
        seoTitle: input.seoTitle?.trim() || null,
        seoDescription: input.seoDescription?.trim() || null,
        contentHtml: sanitizedHtml,
        contentJson: input.contentJson as Prisma.InputJsonValue,
        contentStatus: ArticleContentStatus.READY,
        contentHash
      }
    });

    if (previous?.contentHash !== contentHash) {
      await tx.articleContent.updateMany({
        where: {
          articleId: article.id,
          locale: otherArticleContentLocale(locale),
          generatedFromLocale: locale,
          OR: [
            { title: { not: "" } },
            { contentHtml: { not: "" } }
          ]
        },
        data: {
          contentStatus: ArticleContentStatus.STALE
        }
      });
    }
  });

  void pushArticleUrlAfterPublish(article.id).catch((error) => {
    console.warn("[site-push] automatic manual translation push failed", {
      articleId: article.id,
      locale,
      message: error instanceof Error ? error.message : "Unknown error"
    });
  });

  return { translation: null, articleSlug: article.slug };
}

export async function deleteArticleTranslationsForSource(articleId: string) {
  void articleId;
  return;
}
