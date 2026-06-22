import { loadDotEnv } from "../config/loadDotEnv.js";

loadDotEnv();

const { closeDatabasePool } = await import("../database/connection.js");
const { TranslationJobWorker } = await import("../translation/TranslationJobWorker.js");

function readPositiveInteger(name: string, fallback: number): number {
  const rawValue = process.env[name];

  if (!rawValue || !rawValue.trim()) {
    return fallback;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

async function main(): Promise<void> {
  const controller = new AbortController();
  const worker = new TranslationJobWorker();
  const pollIntervalMs = readPositiveInteger("TRANSLATION_WORKER_POLL_INTERVAL_MS", 2_000);

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => controller.abort());
  }

  console.log("Translation worker started.");
  await worker.runForever({ pollIntervalMs, signal: controller.signal });
  await closeDatabasePool();
  console.log("Translation worker stopped.");
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : "Translation worker failed.");
  await closeDatabasePool();
  process.exitCode = 1;
});
