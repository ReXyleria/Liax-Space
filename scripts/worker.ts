import { runDueScheduledBackup } from "../src/features/backup/scheduler";
import { drainArticleTranslationJobs } from "../src/features/articles/translation-jobs";
import { drainPublicContentTranslationJobs } from "../src/features/i18n/public-content-translations";
import { db, isDatabaseConfigured } from "../src/lib/db";

const intervalMs = Math.max(1000, Number(process.env.BACKGROUND_WORKER_INTERVAL_MS ?? 5000));
let stopping = false;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestStop(signal: string) {
  console.log(`[background-worker] Received ${signal}, stopping after the current tick.`);
  stopping = true;
}

process.on("SIGINT", () => requestStop("SIGINT"));
process.on("SIGTERM", () => requestStop("SIGTERM"));

async function runTick() {
  if (!isDatabaseConfigured()) {
    console.warn("[background-worker] DATABASE_URL is not configured; skipping tick.");
    return;
  }

  await runDueScheduledBackup();
  const results = await Promise.allSettled([
    drainArticleTranslationJobs(),
    drainPublicContentTranslationJobs()
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[background-worker] Queue drain failed", result.reason);
    }
  }
}

async function main() {
  process.env.BACKGROUND_WORKER_ROLE = "worker";
  console.log(`[background-worker] Started with interval ${intervalMs}ms.`);

  while (!stopping) {
    const startedAt = Date.now();
    await runTick().catch((error) => {
      console.error("[background-worker] Tick failed", error);
    });
    const elapsed = Date.now() - startedAt;
    await sleep(Math.max(1000, intervalMs - elapsed));
  }
}

main()
  .catch((error) => {
    console.error("[background-worker] Fatal error", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
