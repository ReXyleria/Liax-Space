import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TranslationJobService } from "./TranslationJobService.js";
import type { TranslationJob } from "./TranslationJobRepository.js";

function createJob(input: Partial<TranslationJob>): TranslationJob {
  const now = new Date("2026-06-22T00:00:00.000Z");

  return {
    attempts: 1,
    completedAt: null,
    createdAt: now,
    errorMessage: null,
    id: 7,
    input: {},
    kind: "translate",
    lockedAt: now,
    progressCompleted: 0,
    progressTotal: 1,
    result: null,
    startedAt: now,
    status: "running",
    updatedAt: now,
    ...input
  };
}

describe("TranslationJobService", () => {
  it("exposes one public progress item per translation segment", async () => {
    const service = new TranslationJobService({
      listActiveJobs: async () => [
        createJob({
          progressCompleted: 2,
          progressTotal: 4
        })
      ]
    } as never);

    const [job] = await service.listActiveJobs();

    assert.deepEqual(job.progressItems.map((item) => ({
      id: item.id,
      index: item.index,
      progressPercent: item.progressPercent,
      status: item.status,
      total: item.total
    })), [
      { id: "7:1", index: 1, progressPercent: 100, status: "succeeded", total: 4 },
      { id: "7:2", index: 2, progressPercent: 100, status: "succeeded", total: 4 },
      { id: "7:3", index: 3, progressPercent: 50, status: "running", total: 4 },
      { id: "7:4", index: 4, progressPercent: 0, status: "queued", total: 4 }
    ]);
    assert.equal(job.progressCompleted, 2);
    assert.equal(job.progressPercent, 50);
    assert.equal(job.progressTotal, 4);
  });
});
