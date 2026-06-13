import { closeDatabasePool } from "../database/connection.js";
import { CleanupUnusedAttachmentsJob } from "./CleanupUnusedAttachmentsJob.js";

async function main(): Promise<void> {
  try {
    const dryRun = !process.argv.slice(2).includes("--execute");
    const result = await new CleanupUnusedAttachmentsJob().run({ dryRun });

    console.log(JSON.stringify({
      candidateCount: result.candidateCount,
      candidates: result.candidates,
      cutoff: result.cutoff.toISOString(),
      deletedCount: result.deletedCount,
      dryRun: result.dryRun,
      failureCount: result.failureCount,
      failures: result.failures
    }, null, 2));

    if (result.failureCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    await closeDatabasePool();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown cleanup-unused-attachments failure.");
  process.exitCode = 1;
});
