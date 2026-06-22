import { AppError } from "../common/AppError.js";
import { logger } from "../common/logger.js";
import { SettingsRepository } from "../settings/SettingsRepository.js";
import { TranslationService } from "./TranslationService.js";
import { TranslationJobRepository, type TranslationJob } from "./TranslationJobRepository.js";

type TranslationJobStore = Pick<TranslationJobRepository, "claimNextQueuedJob" | "markFailed" | "markSucceeded">;
type TranslationExecutor = Pick<TranslationService, "generateSeo" | "translate">;
type TranslationSettingsStore = Pick<SettingsRepository, "getSiteSettings">;

export type TranslationWorkerOptions = {
  pollIntervalMs?: number;
  signal?: AbortSignal;
};

const defaultPollIntervalMs = 2_000;
const defaultChunkConcurrency = 1;
const maxChunkConcurrency = 16;

function errorMessageFromUnknown(error: unknown): string {
  if (error instanceof AppError || error instanceof Error) {
    return error.message;
  }

  return "Translation job failed.";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, ms);

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );
  });
}

function readChunkConcurrencyValue(value: unknown): number {
  const concurrency = typeof value === "string" ? Number(value.trim()) : value;

  if (typeof concurrency !== "number" || !Number.isInteger(concurrency)) {
    return defaultChunkConcurrency;
  }

  return Math.min(Math.max(concurrency, defaultChunkConcurrency), maxChunkConcurrency);
}

export class TranslationJobWorker {
  constructor(
    private readonly repository: TranslationJobStore = new TranslationJobRepository(),
    private readonly translationService: TranslationExecutor = new TranslationService(),
    private readonly settingsRepository: TranslationSettingsStore = new SettingsRepository()
  ) {}

  async processNext(): Promise<boolean> {
    const job = await this.repository.claimNextQueuedJob();

    if (!job) {
      return false;
    }

    await this.processJob(job);
    return true;
  }

  async processAvailable(concurrency = defaultChunkConcurrency): Promise<number> {
    const workerCount = readChunkConcurrencyValue(concurrency);
    const results = await Promise.all(Array.from({ length: workerCount }, () => this.processNext()));

    return results.filter(Boolean).length;
  }

  async runForever(options: TranslationWorkerOptions = {}): Promise<void> {
    const pollIntervalMs = options.pollIntervalMs ?? defaultPollIntervalMs;

    while (!options.signal?.aborted) {
      let processedCount = 0;

      try {
        processedCount = await this.processAvailable(await this.readChunkConcurrency());
      } catch (error) {
        logger.error("translation worker poll failed", {
          errorMessage: errorMessageFromUnknown(error)
        });
      }

      if (processedCount === 0) {
        await sleep(pollIntervalMs, options.signal);
      }
    }
  }

  private async readChunkConcurrency(): Promise<number> {
    const settings = await this.settingsRepository.getSiteSettings();

    return readChunkConcurrencyValue(settings["ai.chunkConcurrency"]);
  }

  private async processJob(job: TranslationJob): Promise<void> {
    try {
      if (job.kind === "translate") {
        const translation = await this.translationService.translate(job.input);
        await this.repository.markSucceeded(job.id, { translation });
        return;
      }

      const seo = await this.translationService.generateSeo(job.input);
      await this.repository.markSucceeded(job.id, { seo });
    } catch (error) {
      const errorMessage = errorMessageFromUnknown(error);
      logger.warn("translation job failed", {
        errorMessage,
        jobId: job.id,
        kind: job.kind
      });
      await this.repository.markFailed(job.id, errorMessage);
    }
  }
}

export function startTranslationWorkerLoop(options: TranslationWorkerOptions = {}): { stop: () => void } {
  const controller = new AbortController();
  const worker = new TranslationJobWorker();
  const pollIntervalMs = options.pollIntervalMs;
  const signal = options.signal ?? controller.signal;

  void worker.runForever({ pollIntervalMs, signal }).catch((error: unknown) => {
    logger.error("translation worker stopped unexpectedly", {
      errorMessage: errorMessageFromUnknown(error)
    });
  });

  return {
    stop: () => controller.abort()
  };
}
