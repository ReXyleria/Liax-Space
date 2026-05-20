import type { CurrentUser } from "@/lib/auth";
import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";
import { assertPermission, canManageArticles } from "@/lib/permissions";
import {
  PublicContentTranslationEntity,
  schedulePublicContentTranslation
} from "@/features/i18n/public-content-translations";
import { normalizeTagSlug } from "@/features/tags/utils";
import { tagMutationSchema } from "@/features/tags/validators";

async function ensureUniqueTagSlug(requestedSlug: string, tagId?: string) {
  const base = normalizeTagSlug(requestedSlug) || "tag";
  let candidate = base;
  let index = 2;

  while (true) {
    const existing = await db.tag.findFirst({
      where: {
        slug: candidate,
        ...(tagId ? { id: { not: tagId } } : {})
      },
      select: { id: true }
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${base}-${index}`;
    index += 1;
  }
}

function scheduleTagTranslation(tag: { id: string; name: string; updatedAt: Date }) {
  schedulePublicContentTranslation({
    entity: PublicContentTranslationEntity.TAG,
    entityId: tag.id,
    fields: { name: tag.name },
    sourceUpdatedAt: tag.updatedAt
  });
}

export async function listConsoleTags(user: CurrentUser) {
  assertPermission(canManageArticles(user), "你没有权限管理标签。");

  if (!isDatabaseConfigured()) {
    return { tags: [], error: "DATABASE_URL 未配置，无法加载标签列表。" };
  }

  return withDatabase(async () => {
    const tags = await db.tag.findMany({
      include: {
        _count: {
          select: {
            articles: true
          }
        }
      },
      orderBy: [{ name: "asc" }]
    });

    return {
      tags,
      error: null as string | null
    };
  }, { tags: [], error: "加载标签列表失败。" });
}

export async function createTag(user: CurrentUser, input: unknown) {
  assertPermission(canManageArticles(user), "你没有权限创建标签。");

  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const parsed = tagMutationSchema.parse(input);
  const slug = await ensureUniqueTagSlug(parsed.slug || parsed.name);

  const tag = await db.tag.create({
    data: {
      name: parsed.name,
      slug,
      color: parsed.color || null
    }
  });
  scheduleTagTranslation(tag);
  return tag;
}

export async function updateTag(user: CurrentUser, input: unknown) {
  assertPermission(canManageArticles(user), "你没有权限编辑标签。");

  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const parsed = tagMutationSchema.parse(input);
  if (!parsed.id) {
    throw new Error("标签不存在。");
  }

  const existing = await db.tag.findUnique({ where: { id: parsed.id } });
  if (!existing) {
    throw new Error("标签不存在。");
  }

  const slug = await ensureUniqueTagSlug(parsed.slug || parsed.name || existing.slug, parsed.id);

  const tag = await db.tag.update({
    where: { id: parsed.id },
    data: {
      name: parsed.name,
      slug,
      color: parsed.color || null
    }
  });
  scheduleTagTranslation(tag);
  return tag;
}

export async function deleteTag(user: CurrentUser, id: string) {
  assertPermission(canManageArticles(user), "你没有权限删除标签。");

  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const tag = await db.tag.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!tag) {
    throw new Error("标签不存在。");
  }

  await db.$transaction([
    db.articleTag.deleteMany({ where: { tagId: id } }),
    db.tag.delete({ where: { id } }),
    db.publicContentTranslation.deleteMany({
      where: { entity: PublicContentTranslationEntity.TAG, entityId: id }
    }),
    db.publicContentTranslationJob.deleteMany({
      where: { entity: PublicContentTranslationEntity.TAG, entityId: id }
    })
  ]);
}
