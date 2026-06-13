import { closeDatabasePool } from "../database/connection.js";
import { CheckConsistencyJob } from "./CheckConsistencyJob.js";

async function main(): Promise<void> {
  try {
    const result = await new CheckConsistencyJob().run();

    console.log(JSON.stringify(result, null, 2));

    if (result.status === "ERROR") {
      process.exitCode = 1;
    }
  } finally {
    await closeDatabasePool();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown check-consistency failure.");
  process.exitCode = 1;
});
