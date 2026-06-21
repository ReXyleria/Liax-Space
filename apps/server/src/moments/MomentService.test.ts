import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MomentService } from "./MomentService.js";
import type { Attachment } from "../attachments/attachments.types.js";
import type { CreateMomentInput, ListMomentsInput, Moment, UpdateMomentInput } from "./moments.types.js";

class MemoryAttachmentRepository {
  attachments = new Map<number, Attachment>();

  async findById(id: number): Promise<Attachment | null> {
    return this.attachments.get(id) ?? null;
  }
}

function createAttachment(patch: Partial<Attachment> = {}): Attachment {
  return {
    createdAt: new Date("2026-06-13T08:00:00.000Z"),
    deletedAt: null,
    id: 42,
    mimeType: "image/png",
    originalFilename: "moment.png",
    ownerId: 1,
    publicUrl: "/uploads/moment.png",
    sha256: "a".repeat(64),
    sizeBytes: 10,
    storageKey: "uploads/2026/06/13/moment.png",
    ...patch
  };
}

class MemoryMomentRepository {
  createdInput: CreateMomentInput | null = null;
  existingMoment: Moment | null = null;
  updatedInput: UpdateMomentInput | null = null;

  async listMoments(_input: ListMomentsInput = {}): Promise<Moment[]> {
    return [];
  }

  async createMoment(input: CreateMomentInput): Promise<Moment> {
    this.createdInput = input;
    return {
      authorId: input.authorId,
      content: input.content,
      createdAt: new Date("2026-06-13T08:00:00.000Z"),
      deletedAt: null,
      id: 1,
      images: input.images ?? [],
      locale: input.locale,
      publishedAt: input.status === "published" ? new Date("2026-06-13T08:00:00.000Z") : null,
      status: input.status ?? "draft",
      updatedAt: new Date("2026-06-13T08:00:00.000Z")
    };
  }

  async findById(id: number): Promise<Moment | null> {
    return this.existingMoment && this.existingMoment.id === id ? this.existingMoment : null;
  }

  async updateMoment(input: UpdateMomentInput): Promise<Moment | null> {
    this.updatedInput = input;

    if (!this.existingMoment || this.existingMoment.id !== input.id) {
      return null;
    }

    this.existingMoment = {
      ...this.existingMoment,
      content: input.content ?? this.existingMoment.content,
      images: input.images ?? this.existingMoment.images,
      locale: input.locale ?? this.existingMoment.locale,
      status: input.status ?? this.existingMoment.status
    };

    return this.existingMoment;
  }

  async softDeleteMoment(_id: number): Promise<Moment | null> {
    return null;
  }
}

describe("MomentService", () => {
  it("preserves image URLs when creating moments", async () => {
    const repository = new MemoryMomentRepository();
    const service = new MomentService(repository);

    const moment = await service.createMoment(1, {
      content: "带图瞬间",
      images: [" /uploads/a.jpg ", "https://example.com/b.jpg", ""],
      locale: "zh-CN",
      status: "published"
    });

    assert.deepEqual(repository.createdInput?.images, ["/uploads/a.jpg", "https://example.com/b.jpg"]);
    assert.deepEqual(moment.images, ["/uploads/a.jpg", "https://example.com/b.jpg"]);
  });

  it("resolves attachment image references when creating moments", async () => {
    const repository = new MemoryMomentRepository();
    const attachmentRepository = new MemoryAttachmentRepository();
    attachmentRepository.attachments.set(42, createAttachment());
    const service = new MomentService(repository, attachmentRepository);

    const moment = await service.createMoment(1, {
      content: "附件图瞬间",
      images: ["attachment://42", "/uploads/existing.jpg"],
      locale: "zh-CN"
    });

    assert.deepEqual(repository.createdInput?.images, ["/uploads/moment.png", "/uploads/existing.jpg"]);
    assert.deepEqual(moment.images, ["/uploads/moment.png", "/uploads/existing.jpg"]);
  });

  it("rejects unavailable attachment image references before saving moments", async () => {
    const repository = new MemoryMomentRepository();
    const attachmentRepository = new MemoryAttachmentRepository();
    const service = new MomentService(repository, attachmentRepository);

    await assert.rejects(
      () => service.createMoment(1, {
        content: "坏附件图瞬间",
        images: ["attachment://404"],
        locale: "zh-CN"
      }),
      /moment image attachment is missing/
    );
    assert.equal(repository.createdInput, null);
  });

  it("rejects non-image attachment references before updating moments", async () => {
    const repository = new MemoryMomentRepository();
    repository.existingMoment = {
      authorId: 1,
      content: "旧内容",
      createdAt: new Date("2026-06-13T08:00:00.000Z"),
      deletedAt: null,
      id: 9,
      images: [],
      locale: "zh-CN",
      publishedAt: null,
      status: "draft",
      updatedAt: new Date("2026-06-13T08:00:00.000Z")
    };
    const attachmentRepository = new MemoryAttachmentRepository();
    attachmentRepository.attachments.set(42, createAttachment({ mimeType: "application/pdf" }));
    const service = new MomentService(repository, attachmentRepository);

    await assert.rejects(
      () => service.updateMoment(9, {
        content: "新内容",
        images: ["attachment://42"]
      }),
      /moment image attachment is not an image/
    );
    assert.equal(repository.updatedInput, null);
  });

  it("rejects non-array image payloads", async () => {
    const service = new MomentService(new MemoryMomentRepository());

    await assert.rejects(
      () => service.createMoment(1, {
        content: "bad images",
        images: "https://example.com/a.jpg",
        locale: "zh-CN"
      }),
      /images must be an array/
    );
  });

  it("updates moment content without changing timestamps", async () => {
    const repository = new MemoryMomentRepository();
    repository.existingMoment = {
      authorId: 1,
      content: "旧内容",
      createdAt: new Date("2026-06-13T08:00:00.000Z"),
      deletedAt: null,
      id: 7,
      images: ["/uploads/old.jpg"],
      locale: "zh-CN",
      publishedAt: new Date("2026-06-13T09:00:00.000Z"),
      status: "published",
      updatedAt: new Date("2026-06-13T10:00:00.000Z")
    };
    const service = new MomentService(repository);

    const moment = await service.updateMoment(7, {
      content: "新内容",
      images: ["/uploads/new.jpg"]
    });

    assert.equal(moment.content, "新内容");
    assert.deepEqual(moment.images, ["/uploads/new.jpg"]);
    assert.equal(Object.hasOwn(repository.updatedInput ?? {}, "createdAt"), false);
    assert.equal(Object.hasOwn(repository.updatedInput ?? {}, "publishedAt"), false);
    assert.equal(Object.hasOwn(repository.updatedInput ?? {}, "updatedAt"), false);
  });

  it("rejects direct timestamp updates", async () => {
    const timestampFields = ["createdAt", "created_at", "updatedAt", "updated_at", "publishedAt", "published_at"];

    for (const field of timestampFields) {
      const repository = new MemoryMomentRepository();
      repository.existingMoment = {
        authorId: 1,
        content: "不能改时间",
        createdAt: new Date("2026-06-13T08:00:00.000Z"),
        deletedAt: null,
        id: 8,
        images: [],
        locale: "zh-CN",
        publishedAt: null,
        status: "draft",
        updatedAt: new Date("2026-06-13T08:00:00.000Z")
      };
      const service = new MomentService(repository);

      await assert.rejects(
        () => service.updateMoment(8, {
          content: "试图改时间",
          [field]: "2026-06-14T08:00:00.000Z"
        }),
        /cannot be updated directly/
      );
      assert.equal(repository.updatedInput, null);
    }
  });
});
