import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MomentService } from "./MomentService.js";
import type { CreateMomentInput, ListMomentsInput, Moment, UpdateMomentInput } from "./moments.types.js";

class MemoryMomentRepository {
  createdInput: CreateMomentInput | null = null;

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

  async findById(_id: number): Promise<Moment | null> {
    return null;
  }

  async updateMoment(_input: UpdateMomentInput): Promise<Moment | null> {
    return null;
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
});
