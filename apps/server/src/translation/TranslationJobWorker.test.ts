import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TranslationJobWorker } from "./TranslationJobWorker.js";
import type { TranslationJob } from "./TranslationJobRepository.js";

function createJob(input: Partial<TranslationJob>): TranslationJob {
  const now = new Date("2026-06-22T00:00:00.000Z");

  return {
    attempts: 1,
    completedAt: null,
    createdAt: now,
    errorMessage: null,
    id: 1,
    input: {},
    kind: "translate",
    lockedAt: now,
    result: null,
    startedAt: now,
    status: "running",
    updatedAt: now,
    ...input
  };
}

describe("TranslationJobWorker", () => {
  it("processes queued translation jobs through the translation service", async () => {
    const successes: unknown[] = [];
    const worker = new TranslationJobWorker(
      {
        claimNextQueuedJob: async () => createJob({
          input: {
            fields: { title: "你好" },
            sourceLocale: "zh-CN",
            targetLocale: "en-US"
          }
        }),
        markFailed: async () => {
          throw new Error("markFailed should not be called.");
        },
        markSucceeded: async (_id, result) => {
          successes.push(result);
        }
      },
      {
        generateSeo: async () => {
          throw new Error("generateSeo should not be called.");
        },
        translate: async () => ({
          fields: { title: "Hello" },
          model: "deepseek-chat",
          provider: "deepseek",
          sourceLocale: "zh-CN",
          targetLocale: "en-US",
          temperature: 1
        })
      }
    );

    assert.equal(await worker.processNext(), true);
    assert.deepEqual(successes, [
      {
        translation: {
          fields: { title: "Hello" },
          model: "deepseek-chat",
          provider: "deepseek",
          sourceLocale: "zh-CN",
          targetLocale: "en-US",
          temperature: 1
        }
      }
    ]);
  });

  it("marks jobs as failed when the translation provider fails", async () => {
    const failures: string[] = [];
    const worker = new TranslationJobWorker(
      {
        claimNextQueuedJob: async () => createJob({ kind: "seo", input: { locale: "zh-CN", title: "标题" } }),
        markFailed: async (_id, errorMessage) => {
          failures.push(errorMessage);
        },
        markSucceeded: async () => {
          throw new Error("markSucceeded should not be called.");
        }
      },
      {
        generateSeo: async () => {
          throw new Error("provider unavailable");
        },
        translate: async () => {
          throw new Error("translate should not be called.");
        }
      }
    );

    assert.equal(await worker.processNext(), true);
    assert.deepEqual(failures, ["provider unavailable"]);
  });
});
