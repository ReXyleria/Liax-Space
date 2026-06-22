import type { ArticleLocale } from "./articleApi";
import { ApiError, httpClient } from "./httpClient";

export type TranslationFields = Record<string, string>;
type AiProvider = "deepseek" | "openai" | "ollama";

export type TranslateRequest = {
  sourceLocale: ArticleLocale;
  targetLocale: ArticleLocale;
  fields: TranslationFields;
  temperature?: number;
};

export type TranslateResponse = {
  translation: {
    provider: AiProvider;
    model: string;
    sourceLocale: ArticleLocale;
    targetLocale: ArticleLocale;
    temperature: number;
    fields: TranslationFields;
  };
};

export type GenerateSeoRequest = {
  contentExcerpt?: string;
  locale: ArticleLocale;
  summary?: string;
  title?: string;
};

export type GenerateSeoResponse = {
  seo: {
    provider: AiProvider;
    model: string;
    locale: ArticleLocale;
    temperature: number;
    fields: {
      seoDescription: string;
      seoTitle: string;
    };
  };
};

type TranslationJobStatus = "queued" | "running" | "succeeded" | "failed";

type TranslationJob<TResult> = {
  id: number;
  kind: "translate" | "seo";
  status: TranslationJobStatus;
  result: TResult | null;
  errorMessage: string | null;
  attempts: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type TranslationJobResponse<TResult> = {
  job: TranslationJob<TResult>;
};

type MaybeJobResponse<TResult> = TResult | TranslationJobResponse<TResult>;

const translationJobPollIntervalMs = 1_500;
const translationJobTimeoutMs = 30 * 60 * 1_000;

function isJobResponse<TResult>(value: MaybeJobResponse<TResult>): value is TranslationJobResponse<TResult> {
  return Boolean(value && typeof value === "object" && "job" in value);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollTranslationJob<TResult>(initialJob: TranslationJob<TResult>): Promise<TResult> {
  const deadline = Date.now() + translationJobTimeoutMs;
  let job = initialJob;

  for (;;) {
    if (job.status === "succeeded") {
      if (!job.result) {
        throw new ApiError({
          code: "TRANSLATION_JOB_EMPTY_RESULT",
          message: "Translation job completed without a result.",
          status: 502
        });
      }

      return job.result;
    }

    if (job.status === "failed") {
      throw new ApiError({
        code: "TRANSLATION_JOB_FAILED",
        message: job.errorMessage ?? "Translation job failed.",
        status: 502
      });
    }

    if (Date.now() >= deadline) {
      throw new ApiError({
        code: "TRANSLATION_JOB_TIMEOUT",
        message: "Translation job did not finish in time.",
        status: 504
      });
    }

    await delay(translationJobPollIntervalMs);
    job = (await httpClient.get<TranslationJobResponse<TResult>>(`/admin/translation-jobs/${job.id}`)).job;
  }
}

async function resolveMaybeJob<TResult>(response: MaybeJobResponse<TResult>): Promise<TResult> {
  return isJobResponse(response) ? pollTranslationJob(response.job) : response;
}

export const translationApi = {
  async generateSeo(input: GenerateSeoRequest): Promise<GenerateSeoResponse> {
    return resolveMaybeJob(await httpClient.post<MaybeJobResponse<GenerateSeoResponse>>("/admin/seo/generate", input));
  },
  async translate(input: TranslateRequest): Promise<TranslateResponse> {
    return resolveMaybeJob(await httpClient.post<MaybeJobResponse<TranslateResponse>>("/admin/translate", input));
  }
};
