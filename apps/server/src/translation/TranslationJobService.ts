import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { TranslationJobRepository, type TranslationJob, type TranslationJobKind } from "./TranslationJobRepository.js";

export type PublicTranslationJob = {
  id: number;
  kind: TranslationJobKind;
  status: TranslationJob["status"];
  result: TranslationJob["result"];
  errorMessage: string | null;
  attempts: number;
  progressCompleted: number;
  progressItems: PublicTranslationJobProgressItem[];
  progressPercent: number;
  progressTotal: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicTranslationJobProgressItem = {
  id: string;
  index: number;
  progressPercent: number;
  status: TranslationJob["status"];
  total: number;
};

function readProgressPercent(job: TranslationJob): number {
  const total = Math.max(1, job.progressTotal);
  const completed = job.status === "succeeded" ? total : Math.min(total, Math.max(0, job.progressCompleted));

  return Math.round((completed / total) * 100);
}

function readProgressItemStatus(
  job: TranslationJob,
  itemIndex: number,
  progressCompleted: number
): TranslationJob["status"] {
  if (job.status === "succeeded") {
    return "succeeded";
  }

  if (job.status === "failed") {
    return itemIndex < progressCompleted ? "succeeded" : "failed";
  }

  if (job.status === "queued") {
    return "queued";
  }

  if (itemIndex < progressCompleted) {
    return "succeeded";
  }

  if (itemIndex === progressCompleted) {
    return "running";
  }

  return "queued";
}

function readProgressItemPercent(status: TranslationJob["status"]): number {
  if (status === "succeeded") {
    return 100;
  }

  if (status === "running") {
    return 50;
  }

  return 0;
}

function buildProgressItems(job: TranslationJob, progressTotal: number, progressCompleted: number): PublicTranslationJobProgressItem[] {
  return Array.from({ length: progressTotal }, (_, itemIndex) => {
    const status = readProgressItemStatus(job, itemIndex, progressCompleted);

    return {
      id: `${job.id}:${itemIndex + 1}`,
      index: itemIndex + 1,
      progressPercent: readProgressItemPercent(status),
      status,
      total: progressTotal
    };
  });
}

function toPublicTranslationJob(job: TranslationJob): PublicTranslationJob {
  const progressTotal = Math.max(1, job.progressTotal);
  const progressCompleted = job.status === "succeeded"
    ? progressTotal
    : Math.min(progressTotal, Math.max(0, job.progressCompleted));

  return {
    attempts: job.attempts,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    errorMessage: job.errorMessage,
    id: job.id,
    kind: job.kind,
    progressCompleted,
    progressItems: buildProgressItems(job, progressTotal, progressCompleted),
    progressPercent: readProgressPercent(job),
    progressTotal,
    result: job.result,
    startedAt: job.startedAt,
    status: job.status,
    updatedAt: job.updatedAt
  };
}

export class TranslationJobService {
  constructor(private readonly repository = new TranslationJobRepository()) {}

  async enqueueTranslate(input: unknown): Promise<PublicTranslationJob> {
    return toPublicTranslationJob(await this.repository.createJob("translate", input));
  }

  async enqueueSeo(input: unknown): Promise<PublicTranslationJob> {
    return toPublicTranslationJob(await this.repository.createJob("seo", input));
  }

  async getJob(id: number): Promise<PublicTranslationJob> {
    const job = await this.repository.findById(id);

    if (!job) {
      throw new AppError("Translation job not found.", {
        code: errorCodes.notFound,
        statusCode: 404
      });
    }

    return toPublicTranslationJob(job);
  }

  async listActiveJobs(): Promise<PublicTranslationJob[]> {
    return (await this.repository.listActiveJobs()).map(toPublicTranslationJob);
  }
}
