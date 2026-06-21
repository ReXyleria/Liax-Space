import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Attachment } from "../api/attachmentApi";
import {
  buildAttachmentPreviewUrls,
  extractAttachmentIdsFromMarkdown,
  loadAttachmentPreviewUrlsForMarkdown
} from "../utils/attachmentPreviewUrls";

function attachment(input: Partial<Attachment> & Pick<Attachment, "id">): Attachment {
  return {
    createdAt: "2026-06-20T00:00:00.000Z",
    deletedAt: null,
    id: input.id,
    isUsed: input.isUsed,
    mimeType: input.mimeType ?? "image/png",
    originalFilename: input.originalFilename ?? `${input.id}.png`,
    ownerId: input.ownerId ?? 1,
    publicUrl: "publicUrl" in input ? input.publicUrl ?? null : `/uploads/${input.id}.png`,
    references: input.references,
    sha256: input.sha256 ?? `${input.id}`.padStart(64, "0"),
    sizeBytes: input.sizeBytes ?? 1,
    storageKey: input.storageKey ?? `uploads/${input.id}.png`
  };
}

describe("attachment preview URL helpers", () => {
  it("builds preview URLs for image attachments only", () => {
    assert.deepEqual(buildAttachmentPreviewUrls([
      attachment({ id: 1, publicUrl: "/uploads/one.png" }),
      attachment({ id: 2, mimeType: "application/pdf", publicUrl: "/uploads/two.pdf" }),
      attachment({ id: 3, publicUrl: null })
    ]), {
      "1": "/uploads/one.png",
      "attachment://1": "/uploads/one.png"
    });
  });

  it("extracts unique attachment ids from markdown in first-seen order", () => {
    assert.deepEqual(
      extractAttachmentIdsFromMarkdown("![A](attachment://42)\n![B](attachment://7)\nagain attachment://42"),
      [42, 7]
    );
  });

  it("loads later attachment pages until referenced images are previewable", async () => {
    const calls: Array<{ limit?: number; offset?: number }> = [];
    const previewUrls = await loadAttachmentPreviewUrlsForMarkdown(
      "![late](attachment://42)",
      async (input) => {
        calls.push(input);

        if (input.offset === 0) {
          return {
            attachments: [
              attachment({ id: 1 }),
              attachment({ id: 2 })
            ]
          };
        }

        return {
          attachments: [
            attachment({ id: 42, publicUrl: "/uploads/late.png" })
          ]
        };
      },
      { pageSize: 2 }
    );

    assert.deepEqual(calls, [
      { limit: 2, offset: 0 },
      { limit: 2, offset: 2 }
    ]);
    assert.equal(previewUrls["42"], "/uploads/late.png");
    assert.equal(previewUrls["attachment://42"], "/uploads/late.png");
  });
});
