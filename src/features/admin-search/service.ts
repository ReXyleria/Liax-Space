import { ArticleStatus } from "@prisma/client";
import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import type { Locale } from "@/lib/i18n-messages";
import {
  canManageArticles,
  canManageComments,
  canManageMoments,
  canManageSettings,
  canManageUsers
} from "@/lib/permissions";
import { getLocalizedSettingDefinitions } from "@/features/settings/service";

export type AdminSearchResult = {
  id: string;
  title: string;
  description?: string | null;
  href: string;
  meta?: string;
};

export type AdminSearchGroup = {
  key: string;
  label: string;
  results: AdminSearchResult[];
};

function includesQuery(value: string | null | undefined, query: string) {
  return value?.toLowerCase().includes(query.toLowerCase()) ?? false;
}

function settingHref(key: string) {
  if (key.startsWith("home.") || key.startsWith("theme.") || key.startsWith("appearance.")) {
    return "/admin/settings/homepage";
  }
  if (key.startsWith("footer.") || key.startsWith("record.") || key.startsWith("contact.")) {
    return "/admin/settings/footer";
  }
  if (key.startsWith("passkey.") || key.includes("requireApproval")) {
    return "/admin/settings/security";
  }
  return "/admin/settings/basic";
}

function groupLabel(locale: Locale, key: string) {
  const zh: Record<string, string> = {
    articles: "文章",
    media: "附件",
    users: "用户",
    comments: "评论",
    moments: "瞬间",
    tags: "标签",
    settings: "设置"
  };
  const en: Record<string, string> = {
    articles: "Articles",
    media: "Media",
    users: "Users",
    comments: "Comments",
    moments: "Moments",
    tags: "Tags",
    settings: "Settings"
  };
  return (locale === "en" ? en : zh)[key] ?? key;
}

export async function searchAdminContent(user: CurrentUser, rawQuery: string, locale: Locale) {
  const query = rawQuery.trim();
  if (!query) {
    return { groups: [] as AdminSearchGroup[], error: null as string | null };
  }
  if (!isDatabaseConfigured()) {
    return { groups: [] as AdminSearchGroup[], error: "DATABASE_URL is not configured." };
  }

  return withDatabase(async () => {
    const groups: AdminSearchGroup[] = [];

    if (canManageArticles(user)) {
      const [articles, tags] = await Promise.all([
        db.article.findMany({
          where: {
            deletedAt: null,
            OR: [
              { title: { contains: query } },
              { slug: { contains: query } },
              { summary: { contains: query } },
              { contentHtml: { contains: query } }
            ]
          },
          select: { id: true, title: true, slug: true, status: true, updatedAt: true },
          orderBy: { updatedAt: "desc" },
          take: 8
        }),
        db.tag.findMany({
          where: {
            OR: [
              { name: { contains: query } },
              { slug: { contains: query } }
            ]
          },
          select: { id: true, name: true, slug: true },
          orderBy: { name: "asc" },
          take: 8
        })
      ]);

      groups.push({
        key: "articles",
        label: groupLabel(locale, "articles"),
        results: articles.map((article) => ({
          id: article.id,
          title: article.title || (locale === "en" ? "Untitled article" : "未命名文章"),
          description: article.slug,
          href: `/admin/articles/${article.id}/edit`,
          meta: article.status === ArticleStatus.PUBLISHED
            ? (locale === "en" ? "Published" : "已发布")
            : (locale === "en" ? "Draft" : "草稿")
        }))
      });

      groups.push({
        key: "tags",
        label: groupLabel(locale, "tags"),
        results: tags.map((tag) => ({
          id: tag.id,
          title: tag.name,
          description: tag.slug,
          href: "/admin/tags"
        }))
      });
    }

    if (canManageSettings(user)) {
      const media = await db.mediaAsset.findMany({
        where: {
          OR: [
            { filename: { contains: query } },
            { url: { contains: query } }
          ]
        },
        select: { id: true, filename: true, url: true, mimeType: true },
        orderBy: { createdAt: "desc" },
        take: 8
      });
      const settingResults = getLocalizedSettingDefinitions(locale)
        .filter((definition) => includesQuery(definition.label, query) || includesQuery(definition.key, query))
        .slice(0, 8);

      groups.push({
        key: "media",
        label: groupLabel(locale, "media"),
        results: media.map((asset) => ({
          id: asset.id,
          title: asset.filename,
          description: asset.url,
          href: `/admin/data/media?q=${encodeURIComponent(asset.filename)}`,
          meta: asset.mimeType
        }))
      });

      groups.push({
        key: "settings",
        label: groupLabel(locale, "settings"),
        results: settingResults.map((definition) => ({
          id: definition.key,
          title: definition.label,
          description: definition.key,
          href: settingHref(definition.key)
        }))
      });
    }

    if (canManageUsers(user)) {
      const users = await db.user.findMany({
        where: {
          OR: [
            { email: { contains: query } },
            { username: { contains: query } },
            { nickname: { contains: query } }
          ]
        },
        select: { id: true, email: true, username: true, nickname: true, role: true },
        orderBy: { updatedAt: "desc" },
        take: 8
      });
      groups.push({
        key: "users",
        label: groupLabel(locale, "users"),
        results: users.map((targetUser) => ({
          id: targetUser.id,
          title: targetUser.nickname,
          description: targetUser.email,
          href: `/admin/users?q=${encodeURIComponent(targetUser.email || targetUser.username || targetUser.nickname)}`,
          meta: targetUser.role
        }))
      });
    }

    if (canManageComments(user)) {
      const comments = await db.comment.findMany({
        where: { deletedAt: null, content: { contains: query } },
        include: {
          article: { select: { title: true } },
          user: { select: { nickname: true } }
        },
        orderBy: { createdAt: "desc" },
        take: 8
      });
      groups.push({
        key: "comments",
        label: groupLabel(locale, "comments"),
        results: comments.map((comment) => ({
          id: comment.id,
          title: comment.content.slice(0, 80),
          description: comment.article.title,
          href: "/admin/comments",
          meta: comment.user.nickname
        }))
      });
    }

    if (canManageMoments(user)) {
      const moments = await db.moment.findMany({
        where: { deletedAt: null, content: { contains: query } },
        select: { id: true, content: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 8
      });
      groups.push({
        key: "moments",
        label: groupLabel(locale, "moments"),
        results: moments.map((moment) => ({
          id: moment.id,
          title: moment.content.slice(0, 80),
          description: moment.createdAt.toLocaleString(locale === "en" ? "en-US" : "zh-CN"),
          href: "/admin/moments"
        }))
      });
    }

    return {
      groups: groups.filter((group) => group.results.length > 0),
      error: null as string | null
    };
  }, { groups: [], error: locale === "en" ? "Search failed." : "搜索失败。" });
}
