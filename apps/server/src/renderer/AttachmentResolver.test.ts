import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AppError } from "../common/AppError.js";
import type { Attachment } from "../attachments/attachments.types.js";
import { AttachmentResolver, type AttachmentLookup } from "./AttachmentResolver.js";

function attachment(input: { id: number; publicUrl?: string | null; deletedAt?: Date | null }): Attachment {
  return {
    id: input.id,
    ownerId: 1,
    originalFilename: "image.png",
    storageKey: `uploads/2026/06/05/${input.id}.png`,
    publicUrl: "publicUrl" in input ? input.publicUrl ?? null : `/uploads/${input.id}.png`,
    mimeType: "image/png",
    sizeBytes: 12,
    sha256: "a".repeat(64),
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    deletedAt: input.deletedAt ?? null
  };
}

function attachmentLookup(attachments: Attachment[]): AttachmentLookup {
  return {
    async findById(id: number): Promise<Attachment | null> {
      return attachments.find((item) => item.id === id) ?? null;
    }
  };
}

describe("AttachmentResolver", () => {
  it("extracts unique attachment ids in first-use order", () => {
    const resolver = new AttachmentResolver(attachmentLookup([]));

    assert.deepEqual(resolver.extractAttachmentIds("a attachment://2 b attachment://1 c attachment://2"), [2, 1]);
  });

  it("replaces attachment references with public URLs", async () => {
    const resolver = new AttachmentResolver(attachmentLookup([attachment({ id: 1, publicUrl: "/files/one.png" })]));
    const result = await resolver.resolve("![Alt](attachment://1) and attachment://1");

    assert.equal(result.markdown, "![Alt](/files/one.png) and /files/one.png");
    assert.deepEqual(result.usedAttachments, [{ id: 1, publicUrl: "/files/one.png" }]);
  });

  it("throws a clear error when an attachment is missing", async () => {
    const resolver = new AttachmentResolver(attachmentLookup([]));

    await assert.rejects(
      () => resolver.resolve("![Alt](attachment://404)"),
      (error) => error instanceof AppError && error.message === "Attachment not found: attachment://404."
    );
  });

  it("throws a clear error when an attachment has no public URL", async () => {
    const resolver = new AttachmentResolver(attachmentLookup([attachment({ id: 2, publicUrl: null })]));

    await assert.rejects(
      () => resolver.resolve("![Alt](attachment://2)"),
      (error) => error instanceof AppError && error.message === "Attachment public URL is missing: attachment://2."
    );
  });

  it("validates attachment references without requiring public URLs", async () => {
    const resolver = new AttachmentResolver(attachmentLookup([attachment({ id: 3, publicUrl: null })]));

    assert.deepEqual(await resolver.validateAttachmentReferences("attachment://3"), [3]);
  });
});
