import { ArticleTranslationJobStatus, PublicContentTranslationJobStatus } from "@prisma/client";
import { db } from "@/lib/db";
import type { QueueHealth } from "@/features/system-health/types";
import { countByStatus, errorMessage, worstStatus } from "@/features/system-health/utils";

const queueStaleAfterMs = 15 * 60 * 1000;

function emptyArticleQueueCounts() {
  return {
    [ArticleTranslationJobStatus.QUEUED]: 0,
    [ArticleTranslationJobStatus.RUNNING]: 0,
    [ArticleTranslationJobStatus.SUCCEEDED]: 0,
    [ArticleTranslationJobStatus.FAILED]: 0,
    [ArticleTranslationJobStatus.CANCELED]: 0,
    staleRunning: 0
  };
}

function emptyPublicQueueCounts() {
  return {
    [PublicContentTranslationJobStatus.QUEUED]: 0,
    [PublicContentTranslationJobStatus.RUNNING]: 0,
    [PublicContentTranslationJobStatus.SUCCEEDED]: 0,
    [PublicContentTranslationJobStatus.FAILED]: 0,
    [PublicContentTranslationJobStatus.CANCELED]: 0,
    staleRunning: 0
  };
}

export async function collectQueueHealth(databaseOk: boolean): Promise<QueueHealth> {
  const article = emptyArticleQueueCounts();
  const publicContent = emptyPublicQueueCounts();
  if (!databaseOk) {
    return { status: "critical", article, publicContent, error: "Database is not available." };
  }

  try {
    const staleBefore = new Date(Date.now() - queueStaleAfterMs);
    const [articleRows, publicRows, staleArticleRunning, stalePublicRunning] = await Promise.all([
      db.articleTranslationJob.groupBy({ by: ["status"], _count: { _all: true } }),
      db.publicContentTranslationJob.groupBy({ by: ["status"], _count: { _all: true } }),
      db.articleTranslationJob.count({
        where: { status: ArticleTranslationJobStatus.RUNNING, updatedAt: { lt: staleBefore } }
      }),
      db.publicContentTranslationJob.count({
        where: { status: PublicContentTranslationJobStatus.RUNNING, updatedAt: { lt: staleBefore } }
      })
    ]);

    const articleCounts = {
      ...countByStatus(Object.values(ArticleTranslationJobStatus), articleRows),
      staleRunning: staleArticleRunning
    };
    const publicContentCounts = {
      ...countByStatus(Object.values(PublicContentTranslationJobStatus), publicRows),
      staleRunning: stalePublicRunning
    };

    return {
      status: worstStatus([
        articleCounts.FAILED > 0 || publicContentCounts.FAILED > 0 ? "warning" : "ok",
        articleCounts.staleRunning > 0 || publicContentCounts.staleRunning > 0 ? "warning" : "ok"
      ]),
      article: articleCounts,
      publicContent: publicContentCounts
    };
  } catch (error) {
    return { status: "warning", article, publicContent, error: errorMessage(error) };
  }
}
