import { runServerDistJob } from "./run-server-dist-job.ts";

async function main(): Promise<void> {
  await runServerDistJob("jobs/runCheckConsistency.js", process.argv.slice(2));
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown check-consistency failure.";
    console.error(message);
    process.exitCode = 1;
  });
