import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAttachmentCleanupCandidates, unusedAttachmentCleanupQuery } from "./CleanupUnusedAttachmentsJob.js";

describe("CleanupUnusedAttachmentsJob", () => {
  it("groups duplicate storage files while keeping all attachment ids", () => {
    const olderDate = new Date("2026-06-10T00:00:00.000Z");
    const newerDate = new Date("2026-06-11T00:00:00.000Z");
    const candidates = buildAttachmentCleanupCandidates([
      {
        createdAt: newerDate,
        id: 6,
        storageKey: "uploads/2026/06/11/shared.png"
      },
      {
        createdAt: olderDate,
        id: 7,
        storageKey: "uploads/2026/06/11/shared.png"
      }
    ]);

    assert.equal(candidates.length, 1);
    assert.deepEqual(candidates[0]?.attachmentIds, [6, 7]);
    assert.equal(candidates[0]?.createdAt, olderDate);
    assert.equal(candidates[0]?.storageKey, "uploads/2026/06/11/shared.png");
  });

  it("filters storage keys that escape the uploads directory", () => {
    const candidates = buildAttachmentCleanupCandidates([
      {
        createdAt: new Date("2026-06-10T00:00:00.000Z"),
        id: 1,
        storageKey: "uploads/../../evil.png"
      }
    ]);

    assert.deepEqual(candidates, []);
  });

  it("does not select a shared storage file when any matching attachment is referenced", () => {
    assert.match(unusedAttachmentCleanupQuery, /referenced_attachment\.storage_key = attachments\.storage_key/u);
    assert.match(unusedAttachmentCleanupQuery, /user_preferences\.avatar_attachment_id = referenced_avatar\.id/u);
    assert.ok(unusedAttachmentCleanupQuery.includes("site_settings.`key` = 'site.logoUrl'"));
    assert.match(unusedAttachmentCleanupQuery, /JSON_CONTAINS\(moments\.images_json, JSON_QUOTE\(attachments\.public_url\)\)/u);
    assert.match(unusedAttachmentCleanupQuery, /JSON_CONTAINS\(moments\.images_json, JSON_QUOTE\(CONCAT\('attachment:\/\/', attachments\.id\)\)\)/u);
  });
});
