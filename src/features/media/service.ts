import { MediaReferenceSource, Prisma } from "@prisma/client";
import { db, isDatabaseConfigured } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { assertPermission, canManageSettings } from "@/lib/permissions";
import { deleteUploadedFileByUrl } from "@/lib/upload";

const UNUSED_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const mediaReferenceSourceValues = Object.values(MediaReferenceSource);
const mediaReferenceSources = new Set<string>(mediaReferenceSourceValues);

async function cleanupInvalidMediaReferences() {
  await db.$executeRaw(
    Prisma.sql`
      DELETE FROM MediaReference
      WHERE source = ''
        OR source NOT IN (${Prisma.join(mediaReferenceSourceValues)})
    `
  );
}

function normalizeMediaSourceFilter(value?: string) {
  const normalized = value?.trim() ?? "";
  if (!normalized || normalized === "all") {
    return null;
  }

  return mediaReferenceSources.has(normalized)
    ? (normalized as MediaReferenceSource)
    : null;
}

function jsonContainsUrl(value: unknown, url: string): boolean {
  if (typeof value === "string") {
    return value.includes(url);
  }
  if (Array.isArray(value)) {
    return value.some((item) => jsonContainsUrl(item, url));
  }
  if (value && typeof value === "object") {
    return Object.values(value).some((item) => jsonContainsUrl(item, url));
  }
  return false;
}

export async function rescanMediaReferences(user: CurrentUser) {
  assertPermission(canManageSettings(user), "You do not have permission to scan media assets.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await cleanupInvalidMediaReferences();

  const [assets, articles, moments, users, settings, mailTemplates, articleVersions, comments] = await Promise.all([
    db.mediaAsset.findMany(),
    db.article.findMany({
      where: { deletedAt: null },
      select: { id: true, contentHtml: true, cover: true }
    }),
    db.moment.findMany({
      where: { deletedAt: null },
      select: { id: true, images: true }
    }),
    db.user.findMany({
      where: { status: { not: "DISABLED" } },
      select: { id: true, avatar: true }
    }),
    db.setting.findMany({
      where: {
        key: {
          in: [
            "site_logo", "site_favicon", "site_background", "site_og_image",
            "home_background", "home_random_backgrounds",
            "footer_logo", "footer_background",
            "email_logo", "email_background",
            "user_default_avatar"
          ]
        }
      },
      select: { id: true, key: true, value: true }
    }),
    db.mailTemplate.findMany({
      select: { id: true, scene: true, bodyHtml: true }
    }),
    db.articleVersion.findMany({
      select: { id: true, contentHtml: true, cover: true }
    }),
    db.comment.findMany({
      where: { deletedAt: null },
      select: { id: true, content: true }
    })
  ]);

  // Also fetch code-injection settings which store HTML/JS/CSS with possible image URLs
  const codeInjectionSettings = await db.setting.findMany({
    where: { key: { in: ["custom_head_html", "custom_body_html", "custom_css"] } },
    select: { id: true, key: true, value: true }
  });

  const now = new Date();
  const cutoff = new Date(Date.now() - UNUSED_AFTER_MS);

  await db.mediaReference.deleteMany();

  for (const asset of assets) {
    const references: Array<{ assetId: string; source: MediaReferenceSource; sourceId: string }> = [];

    for (const article of articles) {
      if (article.contentHtml.includes(asset.url) || article.cover === asset.url) {
        references.push({ assetId: asset.id, source: MediaReferenceSource.ARTICLE, sourceId: article.id });
      }
    }

    for (const moment of moments) {
      if (jsonContainsUrl(moment.images, asset.url)) {
        references.push({ assetId: asset.id, source: MediaReferenceSource.MOMENT, sourceId: moment.id });
      }
    }

    for (const user of users) {
      if (user.avatar && user.avatar.includes(asset.url)) {
        references.push({ assetId: asset.id, source: MediaReferenceSource.USER_AVATAR, sourceId: user.id });
      }
    }

    for (const setting of [...settings, ...codeInjectionSettings]) {
      if (setting.value.includes(asset.url)) {
        references.push({ assetId: asset.id, source: MediaReferenceSource.SETTING, sourceId: setting.id });
      }
    }

    for (const template of mailTemplates) {
      if (template.bodyHtml.includes(asset.url)) {
        references.push({ assetId: asset.id, source: MediaReferenceSource.MAIL_TEMPLATE, sourceId: template.id });
      }
    }

    for (const version of articleVersions) {
      if (version.contentHtml.includes(asset.url) || version.cover === asset.url) {
        references.push({ assetId: asset.id, source: MediaReferenceSource.ARTICLE_VERSION, sourceId: version.id });
      }
    }

    for (const comment of comments) {
      if (comment.content.includes(asset.url)) {
        references.push({ assetId: asset.id, source: MediaReferenceSource.COMMENT, sourceId: comment.id });
      }
    }

    if (references.length) {
      await db.mediaReference.createMany({ data: references, skipDuplicates: true });
      await db.mediaAsset.update({
        where: { id: asset.id },
        data: { isUnused: false, unusedSince: null, lastScannedAt: now }
      });
    } else {
      await db.mediaAsset.update({
        where: { id: asset.id },
        data: {
          isUnused: asset.createdAt <= cutoff,
          unusedSince: asset.createdAt <= cutoff ? asset.unusedSince ?? now : null,
          lastScannedAt: now
        }
      });
    }
  }

  return db.mediaAsset.count({ where: { isUnused: true } });
}

export async function listUnusedMedia(user: CurrentUser) {
  assertPermission(canManageSettings(user), "You do not have permission to manage media assets.");
  if (!isDatabaseConfigured()) {
    return { assets: [], error: "DATABASE_URL is not configured." };
  }

  try {
    await cleanupInvalidMediaReferences();
    return {
      assets: await db.mediaAsset.findMany({
        where: { isUnused: true },
        include: { references: true },
        orderBy: { unusedSince: "desc" }
      }),
      error: null
    };
  } catch (error) {
    console.error("Failed to list unused media assets", error);
    return { assets: [], error: "Failed to load media assets. Invalid media references may need cleanup." };
  }
}

export async function listMediaAssets(
  user: CurrentUser,
  filters: { status?: string; source?: string; q?: string } = {}
) {
  assertPermission(canManageSettings(user), "You do not have permission to manage media assets.");
  if (!isDatabaseConfigured()) {
    return { assets: [], error: "DATABASE_URL is not configured." };
  }

  const source = normalizeMediaSourceFilter(filters.source);

  try {
    await cleanupInvalidMediaReferences();
    const assets = await db.mediaAsset.findMany({
      where: {
        ...(filters.status === "unused" ? { isUnused: true } : {}),
        ...(filters.status === "used" ? { references: { some: {} } } : {}),
        ...(filters.status === "older-unused"
          ? {
              isUnused: true,
              unusedSince: { lte: new Date(Date.now() - UNUSED_AFTER_MS) }
            }
          : {}),
        ...(filters.q
          ? {
              OR: [
                { filename: { contains: filters.q } },
                { url: { contains: filters.q } }
              ]
            }
          : {}),
        ...(source
          ? { references: { some: { source } } }
          : {})
      },
      include: { references: true },
      orderBy: { createdAt: "desc" }
    });

    return { assets, error: null };
  } catch (error) {
    console.error("Failed to list media assets", error);
    return { assets: [], error: "Failed to load media assets. Invalid media references may need cleanup." };
  }
}

export async function deleteUnusedMedia(user: CurrentUser, ids: string[]) {
  assertPermission(canManageSettings(user), "You do not have permission to delete media assets.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await cleanupInvalidMediaReferences();

  const assets = await db.mediaAsset.findMany({
    where: { id: { in: ids }, isUnused: true },
    include: { references: true }
  });
  const deletable = assets.filter((asset) => asset.references.length === 0);

  for (const asset of deletable) {
    await deleteUploadedFileByUrl(asset.url);
  }

  await db.mediaAsset.deleteMany({
    where: {
      id: { in: deletable.map((asset) => asset.id) }
    }
  });

  return deletable.length;
}

export async function deleteMediaAssets(user: CurrentUser, ids: string[]) {
  assertPermission(canManageSettings(user), "You do not have permission to delete media assets.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  await cleanupInvalidMediaReferences();

  const assets = await db.mediaAsset.findMany({
    where: { id: { in: ids } },
    include: { references: true }
  });
  const blocked = assets.filter((asset) => asset.references.length > 0);

  if (blocked.length) {
    throw new Error(`${blocked.length} selected assets are still referenced and were not deleted.`);
  }

  for (const asset of assets) {
    await deleteUploadedFileByUrl(asset.url);
  }

  await db.mediaAsset.deleteMany({
    where: { id: { in: assets.map((asset) => asset.id) } }
  });

  return assets.length;
}
