import { ArticleTranslationJobStatus } from "@prisma/client";
import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { assertPermission, canManageArticles } from "@/lib/permissions";
import { getTranslationConfig } from "@/features/settings/translation-settings";
import { executeArticleTranslation, normalizeTranslationLocale } from "@/features/articles/translation-service";

const ACTIVE_STATUSES: ArticleTranslationJobStatus[] = [
  ArticleTranslationJobStatus.QUEUED,
  ArticleTranslationJobStatus.RUNNING
];

const STALE_RUNNING_MS = 15 * 60 * 1000;

let workerRunning = false;

function toProgressPercent(completedUnits: number, totalUnits: number) {
  if (totalUnits <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((completedUnits / totalUnits) * 100)));
}

function normalizeArticleIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map((item) => String(item)).filter(Boolean)));
}

export async function getDefaultTranslationTargetLocale() {
  const config = await getTranslationConfig().catch(() => null);
  return normalizeTranslationLocale(config?.targetLang ?? "en");
}

export async function enqueueArticleTranslationJobs(
  user: CurrentUser,
  input: { articleIds: unknown; locale: unknown }
) {
  assertPermission(canManageArticles(user), "You do not have permission to translate articles.");

  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const articleIds = normalizeArticleIds(input.articleIds);
  if (!articleIds.length) {
    throw new Error("Select at least one article.");
  }

  const locale = normalizeTranslationLocale(String(input.locale || "en"));
  const articles = await db.article.findMany({
    where: {
      id: { in: articleIds },
      deletedAt: null
    },
    select: { id: true }
  });
  const existingActiveJobs = await db.articleTranslationJob.findMany({
    where: {
      articleId: { in: articles.map((article) => article.id) },
      locale,
      status: { in: ACTIVE_STATUSES }
    },
    select: { articleId: true }
  });
  const activeArticleIds = new Set(existingActiveJobs.map((job) => job.articleId));
  const createArticleIds = articles
    .map((article) => article.id)
    .filter((articleId) => !activeArticleIds.has(articleId));

  if (createArticleIds.length) {
    await db.articleTranslationJob.createMany({
      data: createArticleIds.map((articleId) => ({
        articleId,
        locale,
        createdById: user.id,
        progressMessage: "Queued"
      }))
    });
  }

  ensureArticleTranslationJobWorker();
  return listLatestArticleTranslationJobs(user, articleIds);
}

export async function listLatestArticleTranslationJobs(user: CurrentUser, articleIds: string[]) {
  assertPermission(canManageArticles(user), "You do not have permission to view article translation jobs.");

  if (!isDatabaseConfigured()) {
    return [];
  }

  const jobs = await withDatabase(() => db.articleTranslationJob.findMany({
    where: articleIds.length ? { articleId: { in: articleIds } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      articleId: true,
      locale: true,
      status: true,
      progress: true,
      completedUnits: true,
      totalUnits: true,
      progressMessage: true,
      error: true,
      createdAt: true,
      updatedAt: true,
      startedAt: true,
      completedAt: true
    }
  }), []);

  const latest = new Map<string, (typeof jobs)[number]>();
  for (const job of jobs) {
    const key = `${job.articleId}:${job.locale}`;
    if (!latest.has(key)) {
      latest.set(key, job);
    }
  }

  return Array.from(latest.values());
}

export async function retryArticleTranslationJob(user: CurrentUser, jobId: string) {
  assertPermission(canManageArticles(user), "You do not have permission to retry article translation jobs.");

  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const job = await db.articleTranslationJob.findUnique({
    where: { id: jobId },
    select: { id: true, status: true }
  });
  if (!job) {
    throw new Error("Translation job not found.");
  }

  if (ACTIVE_STATUSES.includes(job.status)) {
    ensureArticleTranslationJobWorker();
    return job;
  }

  const updated = await db.articleTranslationJob.update({
    where: { id: jobId },
    data: {
      status: ArticleTranslationJobStatus.QUEUED,
      progress: 0,
      completedUnits: 0,
      totalUnits: 0,
      progressMessage: "Queued for retry",
      error: null,
      startedAt: null,
      completedAt: null
    }
  });

  ensureArticleTranslationJobWorker();
  return updated;
}

async function resetStaleRunningJobs() {
  const staleBefore = new Date(Date.now() - STALE_RUNNING_MS);
  await db.articleTranslationJob.updateMany({
    where: {
      status: ArticleTranslationJobStatus.RUNNING,
      updatedAt: { lt: staleBefore }
    },
    data: {
      status: ArticleTranslationJobStatus.QUEUED,
      progressMessage: "Recovered stale running job",
      startedAt: null
    }
  });
}

async function claimNextJob() {
  await resetStaleRunningJobs();
  const queued = await db.articleTranslationJob.findFirst({
    where: { status: ArticleTranslationJobStatus.QUEUED },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });

  if (!queued) {
    return null;
  }

  const claimed = await db.articleTranslationJob.updateMany({
    where: {
      id: queued.id,
      status: ArticleTranslationJobStatus.QUEUED
    },
    data: {
      status: ArticleTranslationJobStatus.RUNNING,
      startedAt: new Date(),
      progressMessage: "Starting translation"
    }
  });

  if (!claimed.count) {
    return null;
  }

  return db.articleTranslationJob.findUnique({
    where: { id: queued.id },
    select: {
      id: true,
      articleId: true,
      locale: true
    }
  });
}

async function runJob(job: NonNullable<Awaited<ReturnType<typeof claimNextJob>>>) {
  try {
    await executeArticleTranslation(job.articleId, job.locale, async (progress) => {
      await db.articleTranslationJob.update({
        where: { id: job.id },
        data: {
          progress: toProgressPercent(progress.completedUnits, progress.totalUnits),
          completedUnits: progress.completedUnits,
          totalUnits: progress.totalUnits,
          progressMessage: progress.message
        }
      });
    });

    await db.articleTranslationJob.update({
      where: { id: job.id },
      data: {
        status: ArticleTranslationJobStatus.SUCCEEDED,
        progress: 100,
        progressMessage: "Translation complete",
        error: null,
        completedAt: new Date()
      }
    });
  } catch (error) {
    await db.articleTranslationJob.update({
      where: { id: job.id },
      data: {
        status: ArticleTranslationJobStatus.FAILED,
        error: error instanceof Error ? error.message : "Translation failed.",
        progressMessage: error instanceof Error ? error.message : "Translation failed.",
        completedAt: new Date()
      }
    });
  }
}

async function drainJobs() {
  if (!isDatabaseConfigured()) {
    return;
  }

  while (true) {
    const job = await claimNextJob();
    if (!job) {
      return;
    }
    await runJob(job);
  }
}

export function ensureArticleTranslationJobWorker() {
  if (workerRunning || !isDatabaseConfigured()) {
    return;
  }

  workerRunning = true;
  setTimeout(() => {
    drainJobs()
      .catch((error) => console.error("Article translation job worker failed", error))
      .finally(() => {
        workerRunning = false;
      });
  }, 0);
}
