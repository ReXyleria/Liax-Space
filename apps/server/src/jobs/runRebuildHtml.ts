import { closeDatabasePool } from "../database/connection.js";
import { RebuildHtmlJob } from "./RebuildHtmlJob.js";

async function main(): Promise<void> {
  try {
    const dryRun = process.argv.slice(2).includes("--dry-run");
    const result = await new RebuildHtmlJob().run({ dryRun });

    console.log(JSON.stringify({
      dryRun: result.dryRun,
      failureCount: result.failureCount,
      failures: result.failures,
      successCount: result.successCount,
      total: result.total
    }, null, 2));

    if (result.failureCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    await closeDatabasePool();
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Unknown rebuild-html failure.");
    process.exitCode = 1;
  });
