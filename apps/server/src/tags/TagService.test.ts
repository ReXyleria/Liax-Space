import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TagService } from "./TagService.js";
import type { Tag, TagDetail, TagTranslation, TagTranslationInput } from "./TagRepository.js";

class FakeTagRepository {
  readonly tags = new Map<number, Tag>();
  readonly translations: TagTranslation[] = [];
  private nextId = 1;

  async createTag(): Promise<Tag> {
    const tag = {
      createdAt: new Date("2026-06-14T00:00:00.000Z"),
      id: this.nextId
    };
    this.nextId += 1;
    this.tags.set(tag.id, tag);
    return tag;
  }

  async createTranslation(input: TagTranslationInput): Promise<TagTranslation> {
    const translation = { ...input };
    this.translations.push(translation);
    return translation;
  }

  async findDetailById(id: number): Promise<TagDetail | null> {
    const tag = this.tags.get(id);

    if (!tag) {
      return null;
    }

    return {
      tag,
      translations: this.translations.filter((translation) => translation.tagId === id)
    };
  }

  async findTranslationByLocaleAndSlug(locale: string, slug: string): Promise<TagTranslation | null> {
    return this.translations.find((translation) => translation.locale === locale && translation.slug === slug) ?? null;
  }
}

describe("TagService", () => {
  it("generates unique slugs from names when the admin form does not send slugs", async () => {
    const repository = new FakeTagRepository();
    repository.tags.set(100, { createdAt: new Date("2026-06-14T00:00:00.000Z"), id: 100 });
    repository.translations.push({
      locale: "en-US",
      name: "Linux",
      slug: "linux",
      tagId: 100
    });
    const service = new TagService(repository as never);

    const created = await service.createTag({
      translations: [
        { locale: "zh-CN", name: "Linux" },
        { locale: "en-US", name: "Linux" }
      ]
    });

    assert.deepEqual(
      created.translations.map((translation) => [translation.locale, translation.name, translation.slug]),
      [
        ["zh-CN", "Linux", "linux"],
        ["en-US", "Linux", "linux-2"]
      ]
    );
  });
});
