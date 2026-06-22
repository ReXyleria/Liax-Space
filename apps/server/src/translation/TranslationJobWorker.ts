import { AppError } from "../common/AppError.js";
import { logger } from "../common/logger.js";
import { TranslationService } from "./TranslationService.js";
import { TranslationJobRepository, type TranslationJob } from "./TranslationJobRepository.js";

type TranslationJobStore = Pick<TranslationJobRepository, "claimNextQueuedJob" | "markFailed" | "markSucceeded">;
type TranslationExecutor = Pick<TranslationService, "generateSeo" | "translate">;

export type TranslationWorkerOptions = {
  pollIntervalMs?: number;
  signal?: AbortSignal;
};

const defaultPollIntervalMs = 2_000;

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

export class TranslationJobWorker {
  constructor(
    private readonly repository: TranslationJobStore = new TranslationJobRepository(),
    private readonly translationService: TranslationExecutor = new TranslationService()
  ) {}

  async processNext(): Promise<boolean> {
    const job = await this.repository.claimNextQueuedJob();

    if (!job) {
      return false;
    }

    await this.processJob(job);
    return true;
  }

  async runForever(options: TranslationWorkerOptions = {}): Promise<void> {
    const pollIntervalMs = options.pollIntervalMs ?? defaultPollIntervalMs;

    while (!options.signal?.aborted) {
      let processed = false;

      try {
        processed = await this.processNext();
      } catch (error) {
        logger.error("translation worker poll failed", {
          errorMessage: errorMessageFromUnknown(error)
        });
      }

      if (!processed) {
        await sleep(pollIntervalMs, options.signal);
      }
    }
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
