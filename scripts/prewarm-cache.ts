import { prewarmPublicCache } from "../src/features/cache/prewarm";
import { db } from "../src/lib/db";

async function main() {
  const result = await prewarmPublicCache(Number(process.env.CACHE_PREWARM_LIMIT ?? 50), {
    concurrency: Number(process.env.CACHE_PREWARM_CONCURRENCY ?? 4)
  });

  console.log(`Cache prewarm finished in ${result.durationMs}ms.`);
  console.log(`Base URL: ${result.baseUrl}`);
  console.log(`Succeeded ${result.success}/${result.total} paths.`);

  if (result.failed.length) {
    console.log("Failed paths:");
    for (const item of result.failed) {
      console.log(`- ${item.path}: ${item.status ?? item.error ?? "failed"}`);
    }
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
