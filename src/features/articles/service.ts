import {
  ArticleStatus,
  ContentVisibility,
  MediaReferenceSource,
  Prisma
} from "@prisma/client";
import { randomUUID } from "crypto";
import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";
import { assertPermission, canManageArticles, canViewContent } from "@/lib/permissions";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import type { CurrentUser } from "@/lib/auth";
import { articleMutationSchema, articleMetaSchema, articleQuerySchema } from "@/features/articles/validators";
import {
  resolveArticleDisplayTranslation,
  scheduleArticleTranslationSync
} from "@/features/articles/translation-service";
import { pushArticleUrlAfterPublish } from "@/features/site-push/service";
import { normalizeTagSlug } from "@/features/tags/utils";

const articleInclude = {
  author: { select: { nickname: true } },
  tags: { include: { tag: true } },
  translations: true
} satisfies Prisma.ArticleInclude;

type ArticleWithRelations = Prisma.ArticleGetPayload<{ include: typeof articleInclude }>;
type PublicArticle = ReturnType<typeof mapArticle>;

function scheduleArticleSitePush(articleId: string) {
  void pushArticleUrlAfterPublish(articleId).catch((error) => {
    console.warn("[site-push] automatic article push failed", {
      articleId,
      message: error instanceof Error ? error.message : "Unknown error"
    });
  });
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

const tagWithArticlesInclude = {
  articles: {
    include: {
      article: {
        select: {
          status: true,
          deletedAt: true,
          visibility: true
        }
      }
    }
  }
} satisfies Prisma.TagInclude;

function normalizeArticleSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

async function ensureArticleSlug(requestedSlug?: string | null, articleId?: string) {
  const normalized = normalizeArticleSlug(requestedSlug ?? "");

  if (normalized) {
    const existing = await db.article.findFirst({
      where: {
        slug: normalized,
        ...(articleId ? { id: { not: articleId } } : {})
      },
      select: { id: true }
    });

    if (!existing) {
      return normalized;
    }
  }

  while (true) {
    const candidate = randomUUID();
    const existing = await db.article.findFirst({
      where: {
        slug: candidate,
        ...(articleId ? { id: { not: articleId } } : {})
      },
      select: { id: true }
    });

    if (!existing) {
      return candidate;
    }
  }
}

function normalizeDisplayLocale(locale?: string | null) {
  if (!locale) {
    return null;
  }

  const lower = locale.toLowerCase();
  if (lower.startsWith("en")) {
    return "en";
  }
  if (lower.startsWith("zh")) {
    return "zh-CN";
  }
  return locale;
}

function mapArticle(article: ArticleWithRelations, locale?: string | null) {
  const display = resolveArticleDisplayTranslation(article, locale);
  const { tags, translations: ignoredTranslations, ...rest } = article;
  void ignoredTranslations;
  const normalizedLocale = normalizeDisplayLocale(locale);

  return {
    ...rest,
    title: display.title,
    summary: display.summary,
    contentHtml: display.contentHtml,
    translationLocale: normalizedLocale,
    translationStatus: display.status,
    translationError: display.error,
    publishedAt: rest.publishedAt?.toISOString() ?? null,
    tags: tags.map((item) => item.tag).filter(isDefined)
  };
}

function canViewArticle(
  user: CurrentUser | null,
  article: {
    visibility: ContentVisibility;
  }
) {
  return canViewContent(user, article.visibility);
}

async function nextArticleVersion(articleId: string) {
  const latest = await db.articleVersion.aggregate({
    where: { articleId },
    _max: { version: true }
  });

  return (latest._max.version ?? 0) + 1;
}

async function recordArticleVersion(
  article: Pick<
    ArticleWithRelations,
    | "id"
    | "title"
    | "slug"
    | "summary"
    | "cover"
    | "contentJson"
    | "contentHtml"
    | "status"
    | "visibility"
    | "allowComments"
    | "pinned"
    | "featured"
    | "seoTitle"
    | "seoDescription"
  >,
  tagNames: string[],
  userId: string
) {
  await db.articleVersion.create({
    data: {
      articleId: article.id,
      version: await nextArticleVersion(article.id),
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      cover: article.cover,
      contentJson: article.contentJson as Prisma.InputJsonValue,
      contentHtml: article.contentHtml,
      status: article.status,
      visibility: article.visibility,
      allowComments: article.allowComments,
      pinned: article.pinned,
      featured: article.featured,
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      allowedIdentityIds: [],
      tagNames,
      createdById: userId
    }
  });
}

export async function listPublishedArticles(input: unknown, user: CurrentUser | null, locale?: string | null) {
  const parsed = articleQuerySchema.parse(input);

  if (!isDatabaseConfigured()) {
    return { articles: [], error: "DATABASE_URL is not configured; published articles cannot be loaded." };
  }

  return withDatabase(async () => {
    const where: Prisma.ArticleWhereInput = {
      status: ArticleStatus.PUBLISHED,
      deletedAt: null,
      ...(parsed.q
        ? {
            OR: [
              { title: { contains: parsed.q } },
              { summary: { contains: parsed.q } },
              { contentHtml: { contains: parsed.q } },
              { tags: { some: { tag: { name: { contains: parsed.q } } } } },
              { tags: { some: { tag: { slug: { contains: parsed.q } } } } }
            ]
          }
        : {}),
      ...(parsed.tag ? { tags: { some: { tag: { slug: parsed.tag } } } } : {})
    };

    const rows = await db.article.findMany({
      where,
      include: articleInclude,
      orderBy: parsed.sort === "popular" ? [{ viewCount: "desc" }] : [{ pinned: "desc" }, { publishedAt: "desc" }],
      take: 100
    });

    return {
      articles: rows.filter((article) => canViewArticle(user, article)).map((article) => mapArticle(article, locale)),
      error: null as string | null
    };
  }, { articles: [], error: "Failed to load published articles." });
}

export async function listPublicTags(user: CurrentUser | null) {
  if (!isDatabaseConfigured()) {
    return { tags: [], error: "DATABASE_URL is not configured; tags cannot be loaded." };
  }

  return withDatabase(async () => {
    const rows = await db.tag.findMany({
      include: tagWithArticlesInclude,
      orderBy: { name: "asc" }
    });

    return {
      tags: rows.map((tag) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        color: tag.color,
        articleCount: tag.articles.filter(({ article }) => (
          article.status === ArticleStatus.PUBLISHED &&
          article.deletedAt === null &&
          canViewArticle(user, article)
        )).length
      })),
      error: null as string | null
    };
  }, { tags: [], error: "Failed to load tags." });
}

export async function listPublishedArticleArchives(user: CurrentUser | null, locale?: string | null) {
  const { articles, error } = await listPublishedArticles({ sort: "newest" }, user, locale);
  const groups = new Map<string, {
    key: string;
    year: number;
    month: number;
    label: string;
    articles: PublicArticle[];
  }>();

  for (const article of articles) {
    const date = new Date(article.publishedAt ?? article.createdAt);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        year,
        month,
        label: key,
        articles: []
      });
    }

    groups.get(key)?.articles.push(article);
  }

  return {
    archives: Array.from(groups.values()),
    error
  };
}

export async function getPublishedArticleBySlug(slug: string, user: CurrentUser | null, locale?: string | null) {
  if (!isDatabaseConfigured()) {
    return { article: null, canView: false, error: "DATABASE_URL is not configured; article cannot be loaded." };
  }

  return withDatabase(async () => {
    const article = await db.article.findFirst({
      where: {
        slug,
        status: ArticleStatus.PUBLISHED,
        deletedAt: null
      },
      include: articleInclude
    });

    if (!article) {
      return { article: null, canView: false, error: null as string | null };
    }

    if (!canViewArticle(user, article)) {
      return { article: mapArticle(article, locale), canView: false, error: null as string | null };
    }

    await db.article
      .update({
        where: { id: article.id },
        data: { viewCount: { increment: 1 } }
      })
      .catch((error) => console.error("Failed to increment article view count", error));

    return { article: mapArticle(article, locale), canView: true, error: null as string | null };
  }, { article: null, canView: false, error: "Failed to load article." });
}

export async function listAdminArticles(user: CurrentUser) {
  assertPermission(canManageArticles(user), "You do not have permission to manage articles.");

  if (!isDatabaseConfigured()) {
    return { articles: [], error: "DATABASE_URL is not configured; admin articles cannot be loaded." };
  }

  return withDatabase(async () => {
    const articles = await db.article.findMany({
      where: { deletedAt: null },
      include: articleInclude,
      orderBy: [{ updatedAt: "desc" }],
      take: 100
    });

    return { articles: articles.map((article) => mapArticle(article)), error: null as string | null };
  }, { articles: [], error: "Failed to load admin articles." });
}

export async function getAdminArticle(user: CurrentUser, id: string) {
  assertPermission(canManageArticles(user), "You do not have permission to manage articles.");

  if (!isDatabaseConfigured()) {
    return null;
  }

  const article = await db.article.findUnique({
    where: { id },
    include: articleInclude
  });

  return article ? mapArticle(article) : null;
}

async function syncTags(articleId: string, tagNames: string[]) {
  const cleanNames = Array.from(new Set(tagNames.map((name) => name.trim()).filter(Boolean)));

  await db.articleTag.deleteMany({ where: { articleId } });

  for (const name of cleanNames) {
    const slug = normalizeTagSlug(name) || name.toLowerCase();
    const tag = await db.tag.upsert({
      where: { slug },
      update: { name },
      create: { name, slug }
    });
    await db.articleTag.create({ data: { articleId, tagId: tag.id } });
  }
}

function extractArticleMediaUrls(html: string, cover?: string | null) {
  const urls = new Set<string>();

  if (cover) {
    urls.add(cover);
  }

  for (const match of html.matchAll(/<img[^>]+src=(["'])(.*?)\1/gi)) {
    if (match[2]) {
      urls.add(match[2]);
    }
  }

  return Array.from(urls);
}

async function syncArticleMediaReferences(articleId: string, html: string, cover?: string | null) {
  const urls = extractArticleMediaUrls(html, cover);

  await db.mediaReference.deleteMany({
    where: {
      source: MediaReferenceSource.ARTICLE,
      sourceId: articleId
    }
  });

  if (!urls.length) {
    return;
  }

  const assets = await db.mediaAsset.findMany({
    where: { url: { in: urls } },
    select: { id: true }
  });

  if (!assets.length) {
    return;
  }

  await db.mediaReference.createMany({
    data: assets.map((asset) => ({
      assetId: asset.id,
      source: MediaReferenceSource.ARTICLE,
      sourceId: articleId
    })),
    skipDuplicates: true
  });

  await db.mediaAsset.updateMany({
    where: { id: { in: assets.map((asset) => asset.id) } },
    data: { isUnused: false, unusedSince: null, lastScannedAt: new Date() }
  });
}

export async function createArticle(user: CurrentUser, input: unknown) {
  assertPermission(canManageArticles(user), "You do not have permission to create articles.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }
  const parsed = articleMutationSchema.parse(input);
  const sanitizedHtml = sanitizeArticleHtml(parsed.contentHtml);
  const slug = await ensureArticleSlug(parsed.slug);

  const article = await db.article.create({
    data: {
      title: parsed.title,
      slug,
      summary: parsed.summary,
      cover: parsed.cover,
      contentJson: parsed.contentJson as Prisma.InputJsonValue,
      contentHtml: sanitizedHtml,
      status: parsed.status,
      visibility: parsed.visibility,
      allowComments: parsed.allowComments,
      pinned: parsed.pinned,
      featured: parsed.featured,
      seoTitle: parsed.seoTitle,
      seoDescription: parsed.seoDescription,
      authorId: user.id,
      publishedAt: parsed.status === ArticleStatus.PUBLISHED ? (parsed.publishedAt ?? new Date()) : (parsed.publishedAt ?? null)
    }
  });

  await syncTags(article.id, parsed.tagNames);
  await syncArticleMediaReferences(article.id, sanitizedHtml, parsed.cover);
  const versionArticle = await db.article.findUniqueOrThrow({ where: { id: article.id }, include: articleInclude });
  await recordArticleVersion(versionArticle, parsed.tagNames, user.id);
  scheduleArticleTranslationSync(article);
  if (article.status === ArticleStatus.PUBLISHED) {
    scheduleArticleSitePush(article.id);
  }

  return article;
}

export async function updateArticle(user: CurrentUser, id: string, input: unknown) {
  assertPermission(canManageArticles(user), "You do not have permission to update articles.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }
  const parsed = articleMutationSchema.parse(input);
  const sanitizedHtml = sanitizeArticleHtml(parsed.contentHtml);
  const existing = await db.article.findUnique({ where: { id } });

  if (!existing) {
    throw new Error("Article not found.");
  }

  const slug = await ensureArticleSlug(parsed.slug || existing.slug, id);

  const article = await db.article.update({
    where: { id },
    data: {
      title: parsed.title,
      slug,
      summary: parsed.summary,
      cover: parsed.cover,
      contentJson: parsed.contentJson as Prisma.InputJsonValue,
      contentHtml: sanitizedHtml,
      status: parsed.status,
      visibility: parsed.visibility,
      allowComments: parsed.allowComments,
      pinned: parsed.pinned,
      featured: parsed.featured,
      seoTitle: parsed.seoTitle,
      seoDescription: parsed.seoDescription,
      publishedAt:
        parsed.status === ArticleStatus.PUBLISHED
          ? (parsed.publishedAt ?? existing.publishedAt ?? new Date())
          : (parsed.publishedAt ?? existing.publishedAt)
    }
  });

  await syncTags(article.id, parsed.tagNames);
  await syncArticleMediaReferences(article.id, sanitizedHtml, parsed.cover);
  const versionArticle = await db.article.findUniqueOrThrow({ where: { id: article.id }, include: articleInclude });
  await recordArticleVersion(versionArticle, parsed.tagNames, user.id);
  scheduleArticleTranslationSync(article);
  if (article.status === ArticleStatus.PUBLISHED) {
    scheduleArticleSitePush(article.id);
  }

  return article;
}

export async function listArticleVersions(user: CurrentUser, articleId: string) {
  assertPermission(canManageArticles(user), "You do not have permission to view article versions.");

  if (!isDatabaseConfigured()) {
    return [];
  }

  return withDatabase(() => db.articleVersion.findMany({
    where: { articleId },
    include: { createdBy: { select: { nickname: true } } },
    orderBy: { version: "desc" },
    take: 30
  }), []);
}

export async function restoreArticleVersion(user: CurrentUser, articleId: string, versionId: string) {
  assertPermission(canManageArticles(user), "You do not have permission to restore article versions.");

  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const version = await db.articleVersion.findFirst({
    where: { id: versionId, articleId }
  });

  if (!version) {
    throw new Error("Article version not found.");
  }

  const tagNames = Array.isArray(version.tagNames)
    ? version.tagNames.map((tag) => String(tag)).filter(Boolean)
    : [];
  const slug = await ensureArticleSlug(version.slug, articleId);

  const article = await db.article.update({
    where: { id: articleId },
    data: {
      title: version.title,
      slug,
      summary: version.summary,
      cover: version.cover,
      contentJson: version.contentJson as Prisma.InputJsonValue,
      contentHtml: version.contentHtml,
      status: version.status,
      visibility: version.visibility,
      allowComments: version.allowComments,
      pinned: version.pinned,
      featured: version.featured,
      seoTitle: version.seoTitle,
      seoDescription: version.seoDescription,
      publishedAt: version.status === ArticleStatus.PUBLISHED ? new Date() : null
    }
  });

  await syncTags(articleId, tagNames);
  await syncArticleMediaReferences(articleId, version.contentHtml, version.cover);
  const versionArticle = await db.article.findUniqueOrThrow({ where: { id: article.id }, include: articleInclude });
  await recordArticleVersion(versionArticle, tagNames, user.id);
  scheduleArticleTranslationSync(article);

  return article;
}

export async function setArticleStatus(user: CurrentUser, id: string, status: ArticleStatus) {
  assertPermission(canManageArticles(user), "You do not have permission to change article status.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const article = await db.article.update({
    where: { id },
    data: {
      status,
      publishedAt: status === ArticleStatus.PUBLISHED ? new Date() : undefined
    }
  });

  scheduleArticleTranslationSync(article);
  if (article.status === ArticleStatus.PUBLISHED) {
    scheduleArticleSitePush(article.id);
  }
  return article;
}

export async function deleteArticle(user: CurrentUser, id: string) {
  assertPermission(canManageArticles(user), "You do not have permission to delete articles.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return db.$transaction(async (tx) => {
    await tx.articleTranslation.deleteMany({ where: { articleId: id } });
    await tx.mediaReference.deleteMany({
      where: {
        source: MediaReferenceSource.ARTICLE,
        sourceId: id
      }
    });

    return tx.article.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  });
}

export async function updateArticleMeta(user: CurrentUser, id: string, input: unknown) {
  assertPermission(canManageArticles(user), "You do not have permission to update articles.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }
  const parsed = articleMetaSchema.parse(input);
  const existing = await db.article.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("Article not found.");
  }

  const slug = await ensureArticleSlug(parsed.slug || existing.slug, id);

  const article = await db.article.update({
    where: { id },
    data: {
      slug,
      summary: parsed.summary,
      cover: parsed.cover,
      visibility: parsed.visibility,
      allowComments: parsed.allowComments,
      pinned: parsed.pinned,
      featured: parsed.featured,
      seoTitle: parsed.seoTitle,
      seoDescription: parsed.seoDescription,
      publishedAt:
        parsed.publishedAt ?? existing.publishedAt
    }
  });

  await syncTags(article.id, parsed.tagNames);
  await syncArticleMediaReferences(article.id, existing.contentHtml, parsed.cover);
  scheduleArticleTranslationSync(article);

  return article;
}

export async function getAllTags() {
  if (!isDatabaseConfigured()) {
    return [];
  }

  return withDatabase(() => db.tag.findMany({ orderBy: { name: "asc" } }), []);
}

export { ArticleStatus };
