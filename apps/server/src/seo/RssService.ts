import type { ArticleLocale } from "../articles/articles.types.js";
import { SeoService, localeToPublicPrefix } from "./SeoService.js";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function localeFeedTitle(locale: ArticleLocale): string {
  return locale === "zh-CN" ? "Liax Space 中文文章" : "Liax Space English Posts";
}

function localeFeedDescription(locale: ArticleLocale): string {
  return locale === "zh-CN" ? "Liax Space 已发布中文文章" : "Published English posts from Liax Space";
}

export class RssService {
  constructor(private readonly seoService = new SeoService()) {}

  async renderFeed(locale: ArticleLocale): Promise<string> {
    const articles = await this.seoService.listPublishedArticles(locale);
    const feedUrl = this.seoService.buildLocaleRssUrl(locale);
    const homeUrl = this.seoService.buildLocaleHomeUrl(locale);
    const items = articles
      .map((article) => {
        const articleUrl = this.seoService.buildArticleUrl(article.locale, article.slug);
        const title = article.seoTitle?.trim() || article.title;
        const description = article.seoDescription?.trim() || article.summary?.trim() || "";

        return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(articleUrl)}</link>
      <guid isPermaLink="true">${escapeXml(articleUrl)}</guid>
      <pubDate>${article.publishedAt.toUTCString()}</pubDate>
      <description>${escapeXml(description)}</description>
    </item>`;
      })
      .join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(localeFeedTitle(locale))}</title>
    <link>${escapeXml(homeUrl)}</link>
    <description>${escapeXml(localeFeedDescription(locale))}</description>
    <language>${escapeXml(locale)}</language>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
    <generator>Liax Space</generator>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <ttl>60</ttl>
    <category>${escapeXml(localeToPublicPrefix(locale))}</category>
${items}
  </channel>
</rss>`;
  }
}
