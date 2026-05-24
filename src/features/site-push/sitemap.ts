import { ArticleStatus } from "@prisma/client";
import { db, getDatabaseConfigDiagnostics, isDatabaseConfigured } from "@/lib/db";
import { getIndexableArticleLocaleUrls } from "@/features/articles/indexing";
import { getSettingsMap } from "@/features/settings/service";
import { localizedPath, urlLocales } from "@/lib/locale-url";

export async function generateSitemapXml(): Promise<string> {
  const { settings } = await getSettingsMap();
  const siteUrl = settings["site.url"]?.trim() || "http://localhost:3000";

  if (!isDatabaseConfigured()) {
    return buildXml(siteUrl, []);
  }

  const articles = await loadSitemapArticles();

  const pages = [
    { path: "/", priority: "1.0" },
    { path: "/articles", priority: "0.8" },
    { path: "/moments", priority: "0.6" },
    { path: "/archives", priority: "0.5" },
    { path: "/tags", priority: "0.5" },
    { path: "/guestbook", priority: "0.4" },
    { path: "/contact", priority: "0.3" }
  ];

  const staticUrls = pages.flatMap((page) =>
    urlLocales.map((locale) => ({
      loc: `${siteUrl}${localizedPath(locale, page.path)}`,
      lastmod: new Date().toISOString().split("T")[0],
      priority: page.priority,
      changefreq: page.path === "/" ? "daily" : "weekly",
      alternates: Object.fromEntries(
        urlLocales.map((alternateLocale) => [alternateLocale, `${siteUrl}${localizedPath(alternateLocale, page.path)}`])
      )
    }))
  );

  const articleUrls = articles.flatMap((article) => {
    const localeUrls = getIndexableArticleLocaleUrls(article, siteUrl);
    const alternates = Object.fromEntries(localeUrls.map((item) => [item.locale, item.url]));

    return localeUrls.map((item) => ({
      loc: item.url,
      lastmod: article.updatedAt.toISOString().split("T")[0],
      priority: "0.7",
      changefreq: "weekly",
      alternates
    }));
  });

  return buildXml(siteUrl, [...staticUrls, ...articleUrls]);
}

async function loadSitemapArticles() {
  if (!await canLoadLocalizedArticleUrls()) {
    return [];
  }

  return db.article.findMany({
    where: { status: ArticleStatus.PUBLISHED, deletedAt: null },
    select: {
      slug: true,
      title: true,
      status: true,
      deletedAt: true,
      sourceLocale: true,
      updatedAt: true,
      contents: {
        select: {
          locale: true,
          title: true,
          contentStatus: true
        }
      }
    },
    orderBy: { updatedAt: "desc" }
  }).catch((error) => {
    console.warn("[sitemap] failed to load article URLs", error);
    return [];
  });
}

function buildXml(siteUrl: string, entries: Array<{ loc: string; lastmod: string; priority: string; changefreq: string; alternates?: Record<string, string> }>): string {
  const urls = entries.map((entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
${Object.entries(entry.alternates ?? {}).map(([locale, href]) => `    <xhtml:link rel="alternate" hreflang="${escapeXml(locale)}" href="${escapeXml(href)}" />`).join("\n")}
    <lastmod>${entry.lastmod}</lastmod>
    <priority>${entry.priority}</priority>
    <changefreq>${entry.changefreq}</changefreq>
  </url>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function canLoadLocalizedArticleUrls() {
  const diagnostics = getDatabaseConfigDiagnostics();
  if (!diagnostics.database || diagnostics.databaseUrlInvalid) {
    return false;
  }

  try {
    const rows = await db.$queryRaw<Array<{ columnName: string }>>`
      SELECT COLUMN_NAME AS columnName
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ${diagnostics.database}
        AND (
          (TABLE_NAME = 'Article' AND COLUMN_NAME = 'sourceLocale')
          OR (TABLE_NAME = 'ArticleContent' AND COLUMN_NAME = 'contentStatus')
        )
    `;
    const columns = new Set(rows.map((row) => row.columnName.toLowerCase()));
    return columns.has("sourcelocale") && columns.has("contentstatus");
  } catch (error) {
    console.warn("[sitemap] failed to inspect article schema", error);
    return false;
  }
}
