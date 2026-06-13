import type { ArticleLocale } from "../articles/articles.types.js";
import { SeoService } from "./SeoService.js";

const sitemapLocales: ArticleLocale[] = ["zh-CN", "en-US"];

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toIsoDate(value: Date): string {
  return value.toISOString();
}

export class SitemapService {
  constructor(private readonly seoService = new SeoService()) {}

  renderSitemapIndex(): string {
    const sitemapEntries = sitemapLocales
      .map((locale) => {
        return `  <sitemap>
    <loc>${escapeXml(this.seoService.buildLocaleSitemapUrl(locale))}</loc>
  </sitemap>`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`;
  }

  async renderLocaleSitemap(locale: ArticleLocale): Promise<string> {
    const articles = await this.seoService.listPublishedArticles(locale);
    const urlEntries = articles
      .map((article) => {
        return `  <url>
    <loc>${escapeXml(this.seoService.buildArticleUrl(article.locale, article.slug))}</loc>
    <lastmod>${escapeXml(toIsoDate(article.publishedAt))}</lastmod>
  </url>`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
  }
}
