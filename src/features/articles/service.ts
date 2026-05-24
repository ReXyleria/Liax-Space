import {
  ArticleContentStatus,
  ArticleStatus,
  ContentVisibility,
  MediaReferenceSource,
  Prisma,
  PublicContentTranslationEntity
} from "@prisma/client";
import { randomUUID } from "crypto";
import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";
import { assertPermission, canManageArticles, canViewContent } from "@/lib/permissions";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import type { CurrentUser } from "@/lib/auth";
import { articleMutationSchema, articleMetaSchema, articleQuerySchema } from "@/features/articles/validators";
import {
  scheduleArticleTranslationSync
} from "@/features/articles/translation-service";
import { isIndexableArticleLocale } from "@/features/articles/indexing";
import {
  findArticleContent,
  hashArticleContent,
  isDisplayableArticleContent,
  normalizeArticleContentLocale,
  otherArticleContentLocale,
  resolveArticleContentDisplay,
  type ArticleContentLocale
} from "@/features/articles/content-service";
import { getTranslationConfig } from "@/features/settings/translation-settings";
import {
  getPublicContentTranslationMap,
  translatedField
} from "@/features/i18n/public-content-translations";
import { pushArticleUrlAfterPublish } from "@/features/site-push/service";
import { normalizeTagSlug } from "@/features/tags/utils";
import { localeToUrlLocale } from "@/lib/locale-url";
import { mediaUrlMatchesReference, normalizeMediaReferenceUrl } from "@/lib/media-reference";
import { isValidSeoDescription } from "@/lib/seo";

const articleInclude = {
  author: { select: { nickname: true } },
  tags: { include: { tag: true } },
  contents: true
} satisfies Prisma.ArticleInclude;

type ArticleWithRelations = Prisma.ArticleGetPayload<{ include: typeof articleInclude }>;

const publicArticleListSelect = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  cover: true,
  status: true,
  visibility: true,
  pinned: true,
  featured: true,
  viewCount: true,
  seoTitle: true,
  seoDescription: true,
  sourceLocale: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  tags: { include: { tag: true } },
  contents: {
    select: {
      locale: true,
      title: true,
      summary: true,
      seoTitle: true,
      seoDescription: true,
      contentStatus: true,
      error: true
    }
  }
} satisfies Prisma.ArticleSelect;

type PublicArticleListRow = Prisma.ArticleGetPayload<{ select: typeof publicArticleListSelect }>;
type PublicArticle = ReturnType<typeof mapPublicArticleListItem>;

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
          slug: true,
          title: true,
          status: true,
          deletedAt: true,
          visibility: true,
          sourceLocale: true,
          contents: {
            select: {
              locale: true,
              title: true,
              contentStatus: true
            }
          }
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

function languageStatus(
  article: ArticleWithRelations,
  locale: ArticleContentLocale,
  sourceLocale: ArticleContentLocale
) {
  const content = findArticleContent(article.contents, locale);

  if (locale === sourceLocale) {
    return {
      locale,
      isSource: true,
      ready: isDisplayableArticleContent(content) || Boolean(article.contentHtml.trim()),
      status: content?.contentStatus ?? ArticleContentStatus.READY,
      error: content?.error ?? null
    };
  }

  return {
    locale,
    isSource: false,
    ready: isDisplayableArticleContent(content),
    status: content?.contentStatus ?? null,
    error: content?.error ?? null
  };
}

function serializeContent(content: ArticleWithRelations["contents"][number]) {
  return {
    id: content.id,
    locale: normalizeArticleContentLocale(content.locale),
    title: content.title,
    summary: content.summary,
    seoTitle: content.seoTitle,
    seoDescription: content.seoDescription,
    contentHtml: content.contentHtml,
    contentJson: content.contentJson,
    contentStatus: content.contentStatus,
    contentHash: content.contentHash,
    generatedFromLocale: content.generatedFromLocale,
    generatedAt: content.generatedAt?.toISOString() ?? null,
    error: content.error,
    updatedAtLabel: content.updatedAt.toISOString()
  };
}

function mapArticle(article: ArticleWithRelations, locale?: string | null, translationTargetLocale = "en-US") {
  const requestContentLocale = locale ? normalizeArticleContentLocale(localeToUrlLocale(locale)) : null;
  const display = resolveArticleContentDisplay(article, requestContentLocale, { allowFallback: !requestContentLocale });
  const { tags, contents, ...rest } = article;
  const normalizedLocale = requestContentLocale;
  const sourceLocale = normalizeArticleContentLocale(article.sourceLocale);
  const normalizedTargetLocale = normalizeArticleContentLocale(translationTargetLocale);
  const counterpartLocale = otherArticleContentLocale(sourceLocale);
  const targetContent = findArticleContent(contents, normalizedTargetLocale);
  const counterpartContent = findArticleContent(contents, counterpartLocale);
  const translationReady = normalizedTargetLocale === sourceLocale || isDisplayableArticleContent(targetContent);
  const languageStatuses = {
    "zh-CN": languageStatus(article, "zh-CN", sourceLocale),
    "en-US": languageStatus(article, "en-US", sourceLocale)
  };

  return {
    ...rest,
    sourceLocale,
    title: display.title,
    summary: display.summary,
    seoTitle: display.seoTitle,
    seoDescription: display.seoDescription,
    contentHtml: display.contentHtml,
    contentJson: display.contentJson ?? rest.contentJson,
    translationLocale: normalizedLocale,
    translationStatus: display.status,
    translationError: display.error,
    translationTargetLocale: normalizedTargetLocale,
    translationReady,
    languageStatuses,
    contents: contents.map(serializeContent),
    counterpartLocale,
    counterpartTranslationTitle: counterpartContent?.title ?? null,
    counterpartTranslationSummary: counterpartContent?.summary ?? null,
    counterpartTranslationContentHtml: counterpartContent?.contentHtml ?? null,
    counterpartTranslationSeoTitle: counterpartContent?.seoTitle ?? null,
    counterpartTranslationSeoDescription: counterpartContent?.seoDescription ?? null,
    targetTranslationStatus: targetContent?.contentStatus ?? null,
    targetTranslationTitle: normalizedTargetLocale === sourceLocale ? article.title : targetContent?.title ?? null,
    targetTranslationSummary: normalizedTargetLocale === sourceLocale ? article.summary : targetContent?.summary ?? null,
    targetTranslationContentHtml: normalizedTargetLocale === sourceLocale ? article.contentHtml : targetContent?.contentHtml ?? null,
    targetTranslationSeoTitle: normalizedTargetLocale === sourceLocale ? article.seoTitle : targetContent?.seoTitle ?? null,
    targetTranslationSeoDescription: normalizedTargetLocale === sourceLocale ? article.seoDescription : targetContent?.seoDescription ?? null,
    publishedAt: rest.publishedAt?.toISOString() ?? null,
    tags: tags.map((item) => item.tag).filter(isDefined)
  };
}

function isDisplayableListContent(content: PublicArticleListRow["contents"][number] | null | undefined) {
  return Boolean(
    content &&
    (content.contentStatus === ArticleContentStatus.READY || content.contentStatus === ArticleContentStatus.STALE) &&
    content.title.trim()
  );
}

function mapPublicArticleListItem(article: PublicArticleListRow, locale?: string | null) {
  const requestedLocale = locale ? normalizeArticleContentLocale(localeToUrlLocale(locale)) : null;
  const sourceLocale = normalizeArticleContentLocale(article.sourceLocale);
  const requestedContent = requestedLocale
    ? article.contents.find((content) => normalizeArticleContentLocale(content.locale) === requestedLocale)
    : null;
  const canUseRequestedContent = isDisplayableListContent(requestedContent);
  const canUseSourceContent = !requestedLocale || requestedLocale === sourceLocale;
  const display = canUseRequestedContent
    ? requestedContent
    : canUseSourceContent
      ? article
      : null;

  return {
    id: article.id,
    slug: article.slug,
    title: display?.title ?? requestedContent?.title ?? "",
    summary: display?.summary ?? requestedContent?.summary ?? null,
    cover: article.cover,
    status: article.status,
    visibility: article.visibility,
    pinned: article.pinned,
    featured: article.featured,
    viewCount: article.viewCount,
    seoTitle: display?.seoTitle ?? requestedContent?.seoTitle ?? null,
    seoDescription: display?.seoDescription ?? requestedContent?.seoDescription ?? null,
    sourceLocale,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    deletedAt: article.deletedAt,
    translationLocale: requestedLocale,
    translationStatus: requestedLocale && !display ? ("missing" as const) : null,
    translationError: requestedLocale && !display
      ? requestedContent?.error ?? "Requested article content is unavailable."
      : null,
    tags: article.tags.map((item) => item.tag).filter(isDefined)
  };
}

async function applyTranslatedTagNames<T extends { tags: Array<{ id: string; name: string }> }>(
  rows: T[],
  locale?: string | null
) {
  const tagIds = rows.flatMap((row) => row.tags.map((tag) => tag.id));
  const translations = await getPublicContentTranslationMap(
    PublicContentTranslationEntity.TAG,
    locale ?? "zh-CN",
    tagIds
  );

  if (!translations.size) {
    return rows;
  }

  return rows.map((row) => ({
    ...row,
    tags: row.tags.map((tag) => ({
      ...tag,
      name: translatedField(translations, tag.id, "name", tag.name)
    }))
  }));
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
    | "sourceLocale"
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
      sourceLocale: article.sourceLocale,
      allowedIdentityIds: [],
      tagNames,
      createdById: userId
    }
  });
}

type ArticleContentInput = {
  title: string;
  summary: string | null;
  contentHtml: string;
  contentJson: unknown;
  seoTitle: string | null;
  seoDescription: string | null;
};

async function upsertReadyArticleContent(
  tx: Prisma.TransactionClient,
  articleId: string,
  locale: ArticleContentLocale,
  input: ArticleContentInput,
  previousContents: ArticleWithRelations["contents"] = []
) {
  const contentHash = hashArticleContent({
    title: input.title,
    summary: input.summary,
    contentHtml: input.contentHtml
  });
  const previous = findArticleContent(previousContents, locale);
  const hashChanged = previous?.contentHash !== contentHash;

  await tx.articleContent.upsert({
    where: { articleId_locale: { articleId, locale } },
    update: {
      title: input.title,
      summary: input.summary,
      contentHtml: input.contentHtml,
      contentJson: input.contentJson as Prisma.InputJsonValue,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      contentStatus: ArticleContentStatus.READY,
      contentHash,
      error: null
    },
    create: {
      articleId,
      locale,
      title: input.title,
      summary: input.summary,
      contentHtml: input.contentHtml,
      contentJson: input.contentJson as Prisma.InputJsonValue,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription,
      contentStatus: ArticleContentStatus.READY,
      contentHash
    }
  });

  if (hashChanged) {
    await tx.articleContent.updateMany({
      where: {
        articleId,
        locale: otherArticleContentLocale(locale),
        generatedFromLocale: locale,
        OR: [
          { title: { not: "" } },
          { contentHtml: { not: "" } }
        ]
      },
      data: {
        contentStatus: ArticleContentStatus.STALE
      }
    });
  }

  return { contentHash, hashChanged };
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
              { contents: { some: { title: { contains: parsed.q } } } },
              { contents: { some: { summary: { contains: parsed.q } } } },
              { contents: { some: { contentHtml: { contains: parsed.q } } } },
              { tags: { some: { tag: { name: { contains: parsed.q } } } } },
              { tags: { some: { tag: { slug: { contains: parsed.q } } } } }
            ]
          }
        : {}),
      ...(parsed.tag ? { tags: { some: { tag: { slug: parsed.tag } } } } : {})
    };

    const rows = await db.article.findMany({
      where,
      select: publicArticleListSelect,
      orderBy: parsed.sort === "popular" ? [{ viewCount: "desc" }] : [{ pinned: "desc" }, { publishedAt: "desc" }],
      take: 100
    });

    const articles = rows
      .filter((article) => canViewArticle(user, article))
      .map((article) => mapPublicArticleListItem(article, locale))
      .filter((article) => !locale || article.translationStatus !== "missing");

    return {
      articles: await applyTranslatedTagNames(articles, locale),
      error: null as string | null
    };
  }, { articles: [], error: "Failed to load published articles." });
}

export async function listPublicTags(user: CurrentUser | null, locale?: string | null) {
  if (!isDatabaseConfigured()) {
    return { tags: [], error: "DATABASE_URL is not configured; tags cannot be loaded." };
  }

  return withDatabase(async () => {
    const rows = await db.tag.findMany({
      include: tagWithArticlesInclude,
      orderBy: { name: "asc" }
    });

    const translations = await getPublicContentTranslationMap(
      PublicContentTranslationEntity.TAG,
      locale ?? "zh-CN",
      rows.map((tag) => tag.id)
    );

    return {
      tags: rows.map((tag) => ({
        id: tag.id,
        name: translatedField(translations, tag.id, "name", tag.name),
        slug: tag.slug,
        color: tag.color,
        articleCount: tag.articles.filter(({ article }) => (
          article.status === ArticleStatus.PUBLISHED &&
          article.deletedAt === null &&
          canViewArticle(user, article) &&
          (!locale || isIndexableArticleLocale(article, localeToUrlLocale(locale)))
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

    return { article: mapArticle(article, locale), canView: true, error: null as string | null };
  }, { article: null, canView: false, error: "Failed to load article." });
}

export async function listConsoleArticles(user: CurrentUser) {
  assertPermission(canManageArticles(user), "You do not have permission to manage articles.");

  if (!isDatabaseConfigured()) {
    return { articles: [], error: "DATABASE_URL is not configured; console articles cannot be loaded." };
  }

  return withDatabase(async () => {
    const config = await getTranslationConfig().catch(() => null);
    const translationTargetLocale = normalizeArticleContentLocale(config?.targetLang ?? "en-US");
    const articles = await db.article.findMany({
      where: { deletedAt: null },
      include: articleInclude,
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      take: 100
    });

    return {
      articles: articles.map((article) => mapArticle(article, null, translationTargetLocale)),
      error: null as string | null
    };
  }, { articles: [], error: "Failed to load console articles." });
}

export async function getConsoleArticle(user: CurrentUser, id: string) {
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

  await db.$transaction(async (tx) => {
    const tags = [];
    for (const name of cleanNames) {
      const slug = normalizeTagSlug(name) || name.toLowerCase();
      const tag = await tx.tag.upsert({
        where: { slug },
        update: { name },
        create: { name, slug }
      });
      tags.push(tag);
    }

    await tx.articleTag.deleteMany({ where: { articleId } });

    if (tags.length) {
      await tx.articleTag.createMany({
        data: tags.map((tag) => ({ articleId, tagId: tag.id })),
        skipDuplicates: true
      });
    }
  });
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
  const normalizedUrls = Array.from(new Set(urls.map(normalizeMediaReferenceUrl).filter(Boolean)));

  await db.mediaReference.deleteMany({
    where: {
      source: MediaReferenceSource.ARTICLE,
      sourceId: articleId
    }
  });

  if (!urls.length && !normalizedUrls.length) {
    return;
  }

  const assets = await db.mediaAsset.findMany({
    where: {
      OR: [
        ...(urls.length ? [{ url: { in: urls } }] : []),
        ...(normalizedUrls.length ? [{ url: { in: normalizedUrls } }] : [])
      ]
    },
    select: { id: true, url: true }
  });
  const referencedAssets = assets.filter((asset) =>
    urls.some((url) => mediaUrlMatchesReference(url, asset.url))
  );

  if (!referencedAssets.length) {
    return;
  }

  await db.mediaReference.createMany({
    data: referencedAssets.map((asset) => ({
      assetId: asset.id,
      source: MediaReferenceSource.ARTICLE,
      sourceId: articleId
    })),
    skipDuplicates: true
  });

  await db.mediaAsset.updateMany({
    where: { id: { in: referencedAssets.map((asset) => asset.id) } },
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
  const sourceLocale = normalizeArticleContentLocale(parsed.sourceLocale);

  const article = await db.$transaction(async (tx) => {
    const created = await tx.article.create({
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
        sourceLocale,
        authorId: user.id,
        publishedAt: parsed.status === ArticleStatus.PUBLISHED ? (parsed.publishedAt ?? new Date()) : (parsed.publishedAt ?? null)
      }
    });

    await upsertReadyArticleContent(tx, created.id, sourceLocale, {
      title: parsed.title,
      summary: parsed.summary,
      contentHtml: sanitizedHtml,
      contentJson: parsed.contentJson,
      seoTitle: parsed.seoTitle,
      seoDescription: parsed.seoDescription
    });

    return created;
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
  const sourceLocale = normalizeArticleContentLocale(parsed.sourceLocale);
  const existing = await db.article.findUnique({ where: { id }, include: { contents: true } });

  if (!existing) {
    throw new Error("Article not found.");
  }

  const slug = await ensureArticleSlug(parsed.slug || existing.slug, id);

  const article = await db.$transaction(async (tx) => {
    const updated = await tx.article.update({
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
        sourceLocale,
        publishedAt:
          parsed.status === ArticleStatus.PUBLISHED
            ? (parsed.publishedAt ?? existing.publishedAt ?? new Date())
            : (parsed.publishedAt ?? existing.publishedAt)
      }
    });

    await upsertReadyArticleContent(tx, updated.id, sourceLocale, {
      title: parsed.title,
      summary: parsed.summary,
      contentHtml: sanitizedHtml,
      contentJson: parsed.contentJson,
      seoTitle: parsed.seoTitle,
      seoDescription: parsed.seoDescription
    }, existing.contents);

    return updated;
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
  const sourceLocale = normalizeArticleContentLocale(version.sourceLocale);
  const existing = await db.article.findUnique({ where: { id: articleId }, include: { contents: true } });

  const article = await db.$transaction(async (tx) => {
    const restored = await tx.article.update({
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
        sourceLocale,
        publishedAt: version.status === ArticleStatus.PUBLISHED ? new Date() : null
      }
    });

    await upsertReadyArticleContent(tx, restored.id, sourceLocale, {
      title: version.title,
      summary: version.summary,
      contentHtml: version.contentHtml,
      contentJson: version.contentJson,
      seoTitle: version.seoTitle,
      seoDescription: version.seoDescription
    }, existing?.contents ?? []);

    return restored;
  });

  await syncTags(articleId, tagNames);
  await syncArticleMediaReferences(articleId, version.contentHtml, version.cover);
  const versionArticle = await db.article.findUniqueOrThrow({ where: { id: article.id }, include: articleInclude });
  await recordArticleVersion(versionArticle, tagNames, user.id);
  scheduleArticleTranslationSync(article);
  if (article.status === ArticleStatus.PUBLISHED) {
    scheduleArticleSitePush(article.id);
  }

  return article;
}

export async function setArticleStatus(user: CurrentUser, id: string, status: ArticleStatus) {
  assertPermission(canManageArticles(user), "You do not have permission to change article status.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const existing = await db.article.findUnique({ where: { id }, include: { contents: true } });
  if (!existing) {
    throw new Error("Article not found.");
  }
  if (existing.status === status) {
    return existing;
  }

  const article = await db.article.update({
    where: { id },
    data: {
      status,
      publishedAt: status === ArticleStatus.PUBLISHED ? (existing.publishedAt ?? new Date()) : existing.publishedAt
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
  const existing = await db.article.findUnique({ where: { id }, include: { contents: true } });
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

  const sourceLocale = normalizeArticleContentLocale(existing.sourceLocale);
  const sourceContent = findArticleContent(existing.contents, sourceLocale);
  await db.$transaction((tx) => upsertReadyArticleContent(tx, id, sourceLocale, {
    title: sourceContent?.title ?? existing.title,
    summary: parsed.summary,
    contentHtml: sourceContent?.contentHtml ?? existing.contentHtml,
    contentJson: sourceContent?.contentJson ?? existing.contentJson,
    seoTitle: parsed.seoTitle,
    seoDescription: parsed.seoDescription
  }, existing.contents));
  await syncTags(article.id, parsed.tagNames);
  await syncArticleMediaReferences(article.id, existing.contentHtml, parsed.cover);
  scheduleArticleTranslationSync(article);
  if (existing.status === ArticleStatus.PUBLISHED) {
    scheduleArticleSitePush(article.id);
  }

  return article;
}

export async function updateArticleTranslationSeo(
  user: CurrentUser,
  articleId: string,
  locale: string,
  seoTitle: string,
  seoDescription: string
) {
  assertPermission(canManageArticles(user), "You do not have permission to update article translation SEO.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const normalizedLocale = normalizeArticleContentLocale(locale);
  const normalizedSeoDescription = seoDescription.trim();
  if (normalizedSeoDescription && !isValidSeoDescription(normalizedSeoDescription)) {
    throw new Error("SEO description must be between 25 and 160 characters.");
  }

  const existing = await db.articleContent.findUnique({
    where: { articleId_locale: { articleId, locale: normalizedLocale } },
    select: { id: true }
  });
  if (!existing) {
    return { updated: false };
  }

  await db.articleContent.update({
    where: { articleId_locale: { articleId, locale: normalizedLocale } },
    data: {
      seoTitle: seoTitle.trim() || null,
      seoDescription: normalizedSeoDescription || null
    }
  });
  void pushArticleUrlAfterPublish(articleId).catch((error) => {
    console.warn("[site-push] automatic translation SEO push failed", {
      articleId,
      locale: normalizedLocale,
      message: error instanceof Error ? error.message : "Unknown error"
    });
  });
  return { updated: true };
}

export async function getAllTags() {
  if (!isDatabaseConfigured()) {
    return [];
  }

  return withDatabase(() => db.tag.findMany({ orderBy: { name: "asc" } }), []);
}

export { ArticleStatus };
