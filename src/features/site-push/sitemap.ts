import { ArticleStatus } from "@prisma/client";
import { db, isDatabaseConfigured } from "@/lib/db";
import { getSettingsMap } from "@/features/settings/service";

export async function generateSitemapXml(): Promise<string> {
  const { settings } = await getSettingsMap();
  const siteUrl = settings["site.url"]?.trim() || "http://localhost:3000";

  if (!isDatabaseConfigured()) {
    return buildXml(siteUrl, []);
  }

  const articles = await db.article.findMany({
    where: { status: ArticleStatus.PUBLISHED, deletedAt: null },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" }
  });

  const pages = [
    { path: "/", priority: "1.0" },
    { path: "/articles", priority: "0.8" },
    { path: "/moments", priority: "0.6" },
    { path: "/archives", priority: "0.5" },
    { path: "/tags", priority: "0.5" },
    { path: "/guestbook", priority: "0.4" },
    { path: "/contact", priority: "0.3" }
  ];

  const staticUrls = pages.map((page) => ({
    loc: `${siteUrl}${page.path}`,
    lastmod: new Date().toISOString().split("T")[0],
    priority: page.priority,
    changefreq: page.path === "/" ? "daily" : "weekly"
  }));

  const articleUrls = articles.map((article) => ({
    loc: `${siteUrl}/articles/${article.slug}`,
    lastmod: article.updatedAt.toISOString().split("T")[0],
    priority: "0.7",
    changefreq: "weekly"
  }));

  return buildXml(siteUrl, [...staticUrls, ...articleUrls]);
}

function buildXml(siteUrl: string, entries: Array<{ loc: string; lastmod: string; priority: string; changefreq: string }>): string {
  const urls = entries.map((entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <priority>${entry.priority}</priority>
    <changefreq>${entry.changefreq}</changefreq>
  </url>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}