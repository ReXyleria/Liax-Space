import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LegacyPublicDataSyncJob, mapLegacyMomentStatus, normalizeLegacyImages } from "./LegacyPublicDataSyncJob.js";

type LegacySyncConstructorArgs = ConstructorParameters<typeof LegacyPublicDataSyncJob>;

function createLegacyDatabase(): LegacySyncConstructorArgs[0] {
  return {
    execute: async <T>(): Promise<[T, unknown]> => {
      throw new Error("Legacy sync must not write to the legacy database.");
    },
    query: async <T>(sql: string): Promise<[T, unknown]> => {
      if (sql.includes("FROM Tag")) {
        return [[{ id: "tag-1", name: "AI", slug: "ai", createdAt: new Date("2026-06-10T00:00:00.000Z") }] as T, []];
      }

      if (sql.includes("FROM ArticleTag")) {
        return [[{ articleSlug: "first-post", tagSlug: "ai" }] as T, []];
      }

      if (sql.includes("FROM Moment")) {
        return [
          [
            {
              content: "Legacy moment",
              createdAt: new Date("2026-06-11T00:00:00.000Z"),
              deletedAt: null,
              images: JSON.stringify(["/uploads/moment.jpg"]),
              updatedAt: new Date("2026-06-12T00:00:00.000Z"),
              visibility: "PUBLIC"
            }
          ] as T,
          []
        ];
      }

      throw new Error(`Unexpected legacy query: ${sql}`);
    }
  };
}

function createTargetDatabase(counts: { moments: number; tags: number }): LegacySyncConstructorArgs[1] & { transactionStarts: number } {
  return {
    transactionStarts: 0,
    beginTransaction: async function beginTransaction(): Promise<void> {
      this.transactionStarts += 1;
    },
    commit: async (): Promise<void> => {},
    execute: async <T>(sql: string): Promise<[T, unknown]> => {
      throw new Error(`Unexpected target write: ${sql}`);
    },
    query: async <T>(sql: string): Promise<[T, unknown]> => {
      if (sql.includes("SELECT (SELECT COUNT(*) FROM tags)")) {
        return [[counts] as T, []];
      }

      throw new Error(`Unexpected target query: ${sql}`);
    },
    rollback: async (): Promise<void> => {}
  };
}

describe("LegacyPublicDataSyncJob", () => {
  it("normalizes legacy moment image payloads without dropping valid media", () => {
    assert.deepEqual(
      normalizeLegacyImages(JSON.stringify([
        " /uploads/a.jpg ",
        { url: "https://example.com/b.jpg" },
        { src: "/uploads/c.jpg" },
        { path: "/uploads/d.jpg" },
        "",
        { other: "ignored" }
      ])),
      ["/uploads/a.jpg", "https://example.com/b.jpg", "/uploads/c.jpg", "/uploads/d.jpg"]
    );
  });

  it("maps public non-deleted legacy moments to published and everything else to draft", () => {
    assert.equal(mapLegacyMomentStatus("PUBLIC", null), "published");
    assert.equal(mapLegacyMomentStatus("LOGIN_REQUIRED", null), "draft");
    assert.equal(mapLegacyMomentStatus("PUBLIC", new Date("2026-06-14T00:00:00.000Z")), "draft");
  });

  it("dry-runs without opening a target transaction", async () => {
    const targetDatabase = createTargetDatabase({ moments: 0, tags: 0 });
    const result = await new LegacyPublicDataSyncJob(createLegacyDatabase(), targetDatabase).run({ apply: false });

    assert.equal(result.applied, false);
    assert.equal(result.legacyTags, 1);
    assert.equal(result.legacyArticleTagLinks, 1);
    assert.equal(result.legacyMoments, 1);
    assert.equal(result.momentImages, 1);
    assert.equal(targetDatabase.transactionStarts, 0);
  });

  it("refuses apply when the target public data tables are not empty", async () => {
    const targetDatabase = createTargetDatabase({ moments: 1, tags: 0 });

    await assert.rejects(
      () => new LegacyPublicDataSyncJob(createLegacyDatabase(), targetDatabase).run({ apply: true }),
      /Target database is not empty: tags=0, moments=1/u
    );
    assert.equal(targetDatabase.transactionStarts, 0);
  });
});
