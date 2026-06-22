import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TranslationService } from "./TranslationService.js";

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

function createJsonResponse(content: string): Response {
  return new Response(JSON.stringify({
    choices: [
      {
        message: {
          content
        }
      }
    ]
  }), {
    headers: {
      "content-type": "application/json"
    },
    status: 200
  });
}

describe("TranslationService", () => {
  it("translates long article content in chunks with configured chunk concurrency and default temperature 0", async () => {
    const originalFetch = globalThis.fetch;
    const prompts: Array<Record<string, unknown>> = [];
    const progressUpdates: Array<{ completedUnits: number; totalUnits: number }> = [];
    const temperatures: number[] = [];
    let activeRequests = 0;
    let maxActiveRequests = 0;

    globalThis.fetch = async (_url: FetchInput, init?: FetchInit): Promise<Response> => {
      activeRequests += 1;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);

      try {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          messages: Array<{ content: string }>;
          temperature: number;
        };
        const prompt = JSON.parse(body.messages[1]?.content ?? "{}") as {
          segment?: { index?: number };
        };

        prompts.push(prompt as Record<string, unknown>);
        temperatures.push(body.temperature);

        await new Promise((resolve) => setTimeout(resolve, 5));

        return createJsonResponse(JSON.stringify({
          fields: {
            content: `[segment-${prompt.segment?.index ?? 0}]`
          }
        }));
      } finally {
        activeRequests -= 1;
      }
    };

    try {
      const service = new TranslationService({
        getSiteSettings: async () => ({
          "ai.apiKey": "test-key",
          "ai.chunkConcurrency": 2,
          "ai.provider": "deepseek"
        })
      } as never);
      const result = await service.translate({
        fields: {
          content: "A".repeat(15_000)
        },
        sourceLocale: "zh-CN",
        targetLocale: "en-US"
      }, {
        onProgress: (progress) => {
          progressUpdates.push(progress);
        }
      });

      assert.equal(prompts.length, 3);
      assert.equal(maxActiveRequests, 2);
      assert.deepEqual(temperatures, [0, 0, 0]);
      assert.equal(result.fields.content, "[segment-1][segment-2][segment-3]");
      assert.deepEqual(progressUpdates, [
        { completedUnits: 0, totalUnits: 3 },
        { completedUnits: 1, totalUnits: 3 },
        { completedUnits: 2, totalUnits: 3 },
        { completedUnits: 3, totalUnits: 3 }
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
