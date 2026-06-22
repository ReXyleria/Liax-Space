import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { LegacyPublicDataSyncJob, mapLegacyArticleAllowedRoles, mapLegacyMomentStatus, normalizeLegacyImages } from "./LegacyPublicDataSyncJob.js";

type LegacySyncConstructorArgs = ConstructorParameters<typeof LegacyPublicDataSyncJob>;

function createLegacyDatabase(
  options: { settingTableRows?: Array<{ key: string; type: string; value: unknown }>; siteSettingsTable?: boolean } = {}
): LegacySyncConstructorArgs[0] {
  return {
    execute: async <T>(): Promise<[T, unknown]> => {
      throw new Error("Legacy sync must not write to the legacy database.");
    },
    query: async <T>(sql: string, params?: unknown): Promise<[T, unknown]> => {
      if (sql.includes("FROM Tag")) {
        return [[{ id: "tag-1", name: "AI", slug: "ai", createdAt: new Date("2026-06-10T00:00:00.000Z") }] as T, []];
      }

      if (sql.includes("FROM ArticleTag")) {
        return [[{ articleSlug: "first-post", tagSlug: "ai" }] as T, []];
      }

      if (sql.includes("FROM Article") && sql.includes("visibility")) {
        return [
          [
            { articleSlug: "first-post", visibility: "LOGIN_REQUIRED" },
            { articleSlug: "public-post", visibility: "PUBLIC" },
            { articleSlug: "missing-post", visibility: "PUBLIC" }
          ] as T,
          []
        ];
      }

      if (sql.includes("FROM Article") && sql.includes("COALESCE(publishedAt, createdAt) AS publishedAt")) {
        return [
          [
            { articleSlug: "first-post", publishedAt: new Date("2026-06-01T00:00:00.000Z") },
            { articleSlug: "public-post", publishedAt: new Date("2026-06-02T00:00:00.000Z") },
            { articleSlug: "missing-post", publishedAt: new Date("2026-06-03T00:00:00.000Z") }
          ] as T,
          []
        ];
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

      if (sql.includes("INFORMATION_SCHEMA.TABLES")) {
        const tableName = Array.isArray(params) ? params[0] : null;
        return [
          [
            {
              count:
                (tableName === "site_settings" && options.siteSettingsTable !== false) ||
                (tableName === "Setting" && options.settingTableRows)
                  ? 1
                  : 0
            }
          ] as T,
          []
        ];
      }

      if (sql.includes("FROM site_settings")) {
        return [
          [
            { key: "ai.provider", value_json: JSON.stringify("deepseek") },
            { key: "ai.apiKey", value_json: JSON.stringify("legacy-ai-secret") },
            { key: "smtp.host", value_json: JSON.stringify("smtp.example.test") },
            { key: "smtp.pass", value_json: JSON.stringify("legacy-smtp-secret") }
          ] as T,
          []
        ];
      }

      if (sql.includes("FROM Setting")) {
        return [((options.settingTableRows ?? []) as T), []];
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

  it("maps legacy article visibility to target visible roles", () => {
    assert.deepEqual(mapLegacyArticleAllowedRoles("PUBLIC"), []);
    assert.deepEqual(mapLegacyArticleAllowedRoles("LOGIN_REQUIRED"), ["svip", "ssvip"]);
    assert.deepEqual(mapLegacyArticleAllowedRoles("SVIP"), ["svip"]);
    assert.deepEqual(mapLegacyArticleAllowedRoles("SSVIP"), ["ssvip"]);
    assert.deepEqual(mapLegacyArticleAllowedRoles("PRIVATE"), ["ssvip"]);
  });

  it("dry-runs without opening a target transaction", async () => {
    const targetDatabase = createTargetDatabase({ moments: 0, tags: 0 });
    const result = await new LegacyPublicDataSyncJob(createLegacyDatabase(), targetDatabase).run({ apply: false });

    assert.equal(result.applied, false);
    assert.equal(result.legacyTags, 1);
    assert.equal(result.legacyArticleTagLinks, 1);
    assert.equal(result.legacyArticlePublishedAt, 3);
    assert.equal(result.legacyMoments, 1);
    assert.equal(result.legacyPortableSiteSettings, 4);
    assert.equal(result.momentImages, 1);
    assert.equal(targetDatabase.transactionStarts, 0);
  });

  it("applies legacy article visibility to matching target translations", async () => {
    const writes: Array<{ params: unknown; sql: string }> = [];
    const targetDatabase: LegacySyncConstructorArgs[1] & { commits: number; transactionStarts: number } = {
      commits: 0,
      transactionStarts: 0,
      beginTransaction: async function beginTransaction(): Promise<void> {
        this.transactionStarts += 1;
      },
      commit: async function commit(): Promise<void> {
        this.commits += 1;
      },
      execute: async <T>(sql: string, params?: unknown): Promise<[T, unknown]> => {
        writes.push({ params, sql });

        if (sql.startsWith("INSERT INTO tags")) {
          return [{ affectedRows: 1, insertId: 10 } as T, []];
        }

        if (sql.includes("UPDATE article_translations SET allowed_roles_json")) {
          return [{ affectedRows: 2, insertId: 0 } as T, []];
        }

        if (sql.includes("UPDATE article_translations") && sql.includes("published_at = ?")) {
          return [{ affectedRows: 2, insertId: 0 } as T, []];
        }

        if (sql.includes("INSERT INTO site_settings")) {
          return [{ affectedRows: 1, insertId: 0 } as T, []];
        }

        return [{ affectedRows: 1, insertId: 0 } as T, []];
      },
      query: async <T>(sql: string): Promise<[T, unknown]> => {
        if (sql.includes("SELECT (SELECT COUNT(*) FROM tags)")) {
          return [[{ moments: 0, tags: 0 }] as T, []];
        }

        if (sql.includes("SELECT article_id, slug FROM article_translations")) {
          return [
            [
              { article_id: 21, slug: "first-post" },
              { article_id: 22, slug: "public-post" }
            ] as T,
            []
          ];
        }

        throw new Error(`Unexpected target query: ${sql}`);
      },
      rollback: async (): Promise<void> => {}
    };

    const result = await new LegacyPublicDataSyncJob(createLegacyDatabase(), targetDatabase).run({ apply: true });
    const visibilityWrites = writes.filter((write) => write.sql.includes("UPDATE article_translations SET allowed_roles_json"));

    assert.equal(targetDatabase.transactionStarts, 1);
    assert.equal(targetDatabase.commits, 1);
    assert.equal(result.applied, true);
    assert.equal(result.legacyArticleVisibilities, 3);
    assert.equal(result.legacyArticlePublishedAt, 3);
    assert.equal(result.articleVisibilitiesUpdated, 4);
    assert.equal(result.articlePublishedAtUpdated, 4);
    assert.equal(result.skippedArticleVisibilities, 1);
    assert.equal(result.siteSettingsUpserted, 4);
    assert.deepEqual(visibilityWrites.map((write) => write.params), [
      [JSON.stringify(["svip", "ssvip"]), 21],
      [JSON.stringify([]), 22]
    ]);
    assert.deepEqual(
      writes
        .filter((write) => write.sql.includes("published_at = ?"))
        .map((write) => write.params),
      [
        [new Date("2026-06-01T00:00:00.000Z"), 21],
        [new Date("2026-06-02T00:00:00.000Z"), 22]
      ]
    );
  });

  it("updates article visibility while skipping duplicate public data when the target is not empty", async () => {
    const writes: Array<{ params: unknown; sql: string }> = [];
    const targetDatabase: LegacySyncConstructorArgs[1] & { commits: number; transactionStarts: number } = {
      commits: 0,
      transactionStarts: 0,
      beginTransaction: async function beginTransaction(): Promise<void> {
        this.transactionStarts += 1;
      },
      commit: async function commit(): Promise<void> {
        this.commits += 1;
      },
      execute: async <T>(sql: string, params?: unknown): Promise<[T, unknown]> => {
        writes.push({ params, sql });

        if (sql.includes("UPDATE article_translations SET allowed_roles_json")) {
          return [{ affectedRows: 2, insertId: 0 } as T, []];
        }

        if (sql.includes("UPDATE article_translations") && sql.includes("published_at = ?")) {
          return [{ affectedRows: 2, insertId: 0 } as T, []];
        }

        if (sql.includes("INSERT INTO site_settings")) {
          return [{ affectedRows: 1, insertId: 0 } as T, []];
        }

        throw new Error(`Unexpected target write for non-empty repair: ${sql}`);
      },
      query: async <T>(sql: string): Promise<[T, unknown]> => {
        if (sql.includes("SELECT (SELECT COUNT(*) FROM tags)")) {
          return [[{ moments: 1, tags: 1 }] as T, []];
        }

        if (sql.includes("SELECT article_id, slug FROM article_translations")) {
          return [
            [
              { article_id: 21, slug: "first-post" },
              { article_id: 22, slug: "public-post" }
            ] as T,
            []
          ];
        }

        throw new Error(`Unexpected target query: ${sql}`);
      },
      rollback: async (): Promise<void> => {}
    };

    const result = await new LegacyPublicDataSyncJob(createLegacyDatabase(), targetDatabase).run({ apply: true });

    assert.equal(targetDatabase.transactionStarts, 1);
    assert.equal(targetDatabase.commits, 1);
    assert.equal(result.applied, true);
    assert.equal(result.tagsInserted, 0);
    assert.equal(result.tagTranslationsInserted, 0);
    assert.equal(result.articleTagLinksInserted, 0);
    assert.equal(result.skippedArticleTagLinks, 1);
    assert.equal(result.momentsInserted, 0);
    assert.equal(result.articleVisibilitiesUpdated, 4);
    assert.equal(result.articlePublishedAtUpdated, 4);
    assert.equal(result.siteSettingsUpserted, 4);
    assert.deepEqual(
      writes
        .filter((write) => !write.sql.includes("INSERT INTO site_settings"))
        .map((write) => write.params),
      [
      [JSON.stringify(["svip", "ssvip"]), 21],
      [JSON.stringify([]), 22],
      [new Date("2026-06-01T00:00:00.000Z"), 21],
      [new Date("2026-06-02T00:00:00.000Z"), 22]
      ]
    );
    assert.deepEqual(
      writes
        .filter((write) => write.sql.includes("INSERT INTO site_settings"))
        .map((write) => write.params),
      [
        ["ai.apiKey", JSON.stringify("legacy-ai-secret")],
        ["ai.provider", JSON.stringify("deepseek")],
        ["smtp.host", JSON.stringify("smtp.example.test")],
        ["smtp.pass", JSON.stringify("legacy-smtp-secret")]
      ]
    );
  });

  it("maps old Setting translation and SMTP keys to target portable settings", async () => {
    const writes: Array<{ params: unknown; sql: string }> = [];
    const targetDatabase: LegacySyncConstructorArgs[1] & { commits: number; transactionStarts: number } = {
      commits: 0,
      transactionStarts: 0,
      beginTransaction: async function beginTransaction(): Promise<void> {
        this.transactionStarts += 1;
      },
      commit: async function commit(): Promise<void> {
        this.commits += 1;
      },
      execute: async <T>(sql: string, params?: unknown): Promise<[T, unknown]> => {
        writes.push({ params, sql });

        if (sql.includes("UPDATE article_translations SET allowed_roles_json")) {
          return [{ affectedRows: 2, insertId: 0 } as T, []];
        }

        if (sql.includes("UPDATE article_translations") && sql.includes("published_at = ?")) {
          return [{ affectedRows: 2, insertId: 0 } as T, []];
        }

        if (sql.includes("INSERT INTO site_settings")) {
          return [{ affectedRows: 1, insertId: 0 } as T, []];
        }

        throw new Error(`Unexpected target write for Setting migration: ${sql}`);
      },
      query: async <T>(sql: string): Promise<[T, unknown]> => {
        if (sql.includes("SELECT (SELECT COUNT(*) FROM tags)")) {
          return [[{ moments: 1, tags: 1 }] as T, []];
        }

        if (sql.includes("SELECT article_id, slug FROM article_translations")) {
          return [
            [
              { article_id: 21, slug: "first-post" },
              { article_id: 22, slug: "public-post" }
            ] as T,
            []
          ];
        }

        throw new Error(`Unexpected target query: ${sql}`);
      },
      rollback: async (): Promise<void> => {}
    };

    const result = await new LegacyPublicDataSyncJob(
      createLegacyDatabase({
        siteSettingsTable: false,
        settingTableRows: [
          { key: "translation.apiKey", type: "PASSWORD", value: "legacy-ai-secret" },
          { key: "translation.baseUrl", type: "TEXT", value: "https://api.deepseek.com" },
          { key: "translation.model", type: "TEXT", value: "deepseek-chat" },
          { key: "translation.provider", type: "TEXT", value: "DeepSeek" },
          { key: "smtp.encryption", type: "TEXT", value: "STARTTLS" },
          { key: "smtp.notificationsEnabled", type: "BOOLEAN", value: "true" },
          { key: "smtp.pass", type: "PASSWORD", value: "legacy-smtp-secret" },
          { key: "smtp.port", type: "NUMBER", value: "587" }
        ]
      }),
      targetDatabase
    ).run({ apply: true });

    const settingWrites = writes
      .filter((write) => write.sql.includes("INSERT INTO site_settings"))
      .map((write) => write.params);

    assert.equal(result.legacyPortableSiteSettings, 8);
    assert.equal(result.siteSettingsUpserted, 8);
    assert.deepEqual(settingWrites, [
      ["ai.apiKey", JSON.stringify("legacy-ai-secret")],
      ["ai.baseUrl", JSON.stringify("https://api.deepseek.com")],
      ["ai.model", JSON.stringify("deepseek-chat")],
      ["ai.provider", JSON.stringify("deepseek")],
      ["smtp.encryption", JSON.stringify("starttls")],
      ["smtp.notificationsEnabled", JSON.stringify(true)],
      ["smtp.pass", JSON.stringify("legacy-smtp-secret")],
      ["smtp.port", JSON.stringify(587)]
    ]);
  });
});
