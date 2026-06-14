import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SearchResult } from "../search/SearchService.js";
import { renderArchiveBody, renderGuestbookBody, renderHomePage, renderMomentsBody, renderPublicSectionPage, renderTagCards } from "./PublicArticleController.js";

function createSearchResult(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    articleId: 1,
    articleStatus: "published",
    locale: "zh-CN",
    publishStatus: "published",
    publishedAt: new Date("2026-05-01T08:00:00.000Z"),
    seoDescription: null,
    seoTitle: null,
    slug: "example",
    summary: null,
    title: "示例文章",
    updatedAt: new Date("2026-05-01T08:00:00.000Z"),
    url: null,
    ...overrides
  };
}

describe("public home page rendering", () => {
  it("renders contact items without a separate contact title", () => {
    const html = renderHomePage("zh-CN", "zh", {
      "home.contactItems": "邮箱:hello@example.com\nQQ:123456\n主页:https://example.com"
    });

    assert.match(html, /邮箱/);
    assert.match(html, /hello@example\.com/);
    assert.match(html, /QQ/);
    assert.match(html, /123456/);
    assert.match(html, /主页/);
    assert.doesNotMatch(html, />联系作者</);
    assert.doesNotMatch(html, /<strong>/);
  });

  it("renders locale-specific contact labels when configured", () => {
    const zhHtml = renderHomePage("zh-CN", "zh", {
      "home.contactItems.en-US": "Email:hello@example.com\nWebsite:https://example.com",
      "home.contactItems.zh-CN": "邮箱:hello@example.com\n主页:https://example.com"
    });
    const enHtml = renderHomePage("en-US", "en", {
      "home.contactItems.en-US": "Email:hello@example.com\nWebsite:https://example.com",
      "home.contactItems.zh-CN": "邮箱:hello@example.com\n主页:https://example.com"
    });

    assert.match(zhHtml, /邮箱/);
    assert.match(zhHtml, /主页/);
    assert.doesNotMatch(zhHtml, /Website/);
    assert.match(enHtml, /Email/);
    assert.match(enHtml, /Website/);
    assert.doesNotMatch(enHtml, /邮箱/);
  });

  it("does not leak legacy Chinese contact labels into the English page", () => {
    const html = renderHomePage("en-US", "en", {
      "home.contactItems": "邮箱:hello@example.com\nQQ:123456"
    });

    assert.match(html, /Email/);
    assert.doesNotMatch(html, /邮箱/);
  });

  it("renders the ICP number as a link to the configured filing platform", () => {
    const html = renderHomePage("zh-CN", "zh", {
      "home.icpNumber": "蜀ICP备20260606号-1",
      "home.icpUrl": "https://beian.miit.gov.cn/"
    });

    assert.match(
      html,
      /<a href="https:\/\/beian\.miit\.gov\.cn\/" rel="noopener noreferrer" target="_blank">蜀ICP备20260606号-1<\/a>/
    );
  });

  it("keeps the public home page on the warm design system contract", () => {
    const html = renderHomePage("en-US", "en", {});

    assert.match(html, /--color-page: #faf9f5/);
    assert.match(html, /--color-text: #141413/);
    assert.match(html, /height: 76px/);
    assert.match(html, /data-language-switch-placeholder="true"/);
    assert.match(html, /document\.documentElement\.clientWidth/);
    assert.match(html, /class="liax-public-avatar"/);
    assert.match(html, /<a class="liax-public-avatar" href="\/console" aria-label="Console"/);
    assert.match(html, /data-public-search-overlay-trigger/);
    assert.match(html, /class="liax-public-search-form liax-public-search-form--inline"/);
    assert.match(html, /class="liax-public-search-form liax-public-search-form--sidebar"/);
    assert.match(html, /width: min\(1440px, calc\(100% - clamp\(32px, 6vw, 96px\)\)\)/);
    assert.match(html, /data-public-sidebar-toggle/);
    assert.doesNotMatch(html, /href="\/en\/account"/);
    assert.doesNotMatch(html, /background-image:\s*url\(/i);
    assert.doesNotMatch(html, /linear-gradient\([^)]*(blue|purple|violet)/i);
  });

  it("renders configured public logo and theme preset colors", () => {
    const html = renderHomePage("zh-CN", "zh", {
      "site.logoAlt": "Liax Space custom logo",
      "site.logoUrl": "https://example.com/logo.png",
      "theme.preset": "quiet-garden"
    });

    assert.match(html, /<img alt="Liax Space custom logo" src="https:\/\/example\.com\/logo\.png">/);
    assert.match(html, /--color-primary: #102316;/);
    assert.match(html, /--color-brand: #3f6b4a;/);
  });
});

describe("public section page rendering", () => {
  it("renders language-prefixed section pages with alternate links", () => {
    const html = renderPublicSectionPage("en-US", "en", "posts");

    assert.match(html, /<html lang="en-US">/);
    assert.match(html, /<link rel="canonical" href="\/en\/posts">/);
    assert.match(html, /<link rel="alternate" hreflang="zh-CN" href="\/zh\/posts">/);
    assert.match(html, /Articles · Liax Space/);
    assert.match(html, /data-language-switch-placeholder="true"/);
    assert.match(html, /<a class="liax-public-avatar" href="\/console" aria-label="Console"/);
    assert.match(html, /data-public-search-overlay-trigger/);
    assert.match(html, /width: min\(1440px, calc\(100% - clamp\(32px, 6vw, 96px\)\)\)/);
  });

  it("applies configured public logo and theme settings to section pages", () => {
    const html = renderPublicSectionPage("en-US", "en", "tags", undefined, {
      "site.logoAlt": "Section logo",
      "site.logoUrl": "https://example.com/section-logo.png",
      "theme.preset": "clear-graphite"
    });

    assert.match(html, /<img alt="Section logo" src="https:\/\/example\.com\/section-logo\.png">/);
    assert.match(html, /--color-primary: #111315;/);
    assert.match(html, /--color-brand: #5a554f;/);
  });

  it("states that missing public pages do not fallback to another language", () => {
    const html = renderPublicSectionPage(
      "en-US",
      "en",
      "not-found",
      "<p>No public article or page was found for the current language.</p><p>The public site does not automatically fall back to another language.</p>"
    );

    assert.match(html, /Page not found · Liax Space/);
    assert.match(html, /does not automatically fall back to another language/);
  });

  it("renders the public guestbook form and hides entry email addresses", () => {
    const html = renderGuestbookBody("zh-CN", "zh", [{
      authorName: "访客",
      content: "你好",
      createdAt: new Date("2026-06-13T08:00:00.000Z"),
      deletedAt: null,
      email: "visitor@example.test",
      id: 1,
      isPublic: true,
      locale: "zh-CN",
      notifyOnly: false
    }]);

    assert.match(html, /邮箱不会在前台公开/);
    assert.match(html, /仅发送给站主/);
    assert.match(html, /提交留言/);
    assert.match(html, /访客/);
    assert.match(html, /你好/);
    assert.doesNotMatch(html, /visitor@example\.test/);
  });

  it("renders moment images without dropping migrated legacy media", () => {
    const html = renderMomentsBody("zh-CN", [{
      authorId: null,
      content: "带图片的瞬间",
      createdAt: new Date("2026-06-13T08:00:00.000Z"),
      deletedAt: null,
      id: 1,
      images: ["/uploads/moment-a.jpg", "https://example.com/moment-b.jpg"],
      locale: "zh-CN",
      publishedAt: new Date("2026-06-13T08:00:00.000Z"),
      status: "published",
      updatedAt: new Date("2026-06-13T08:00:00.000Z")
    }]);

    assert.match(html, /class="liax-moment-images"/);
    assert.match(html, /src="\/uploads\/moment-a\.jpg"/);
    assert.match(html, /src="https:\/\/example\.com\/moment-b\.jpg"/);
  });

  it("renders public tag article counts from the migrated legacy tag index", () => {
    const zhHtml = renderTagCards("zh-CN", [{
      articleCounts: { "en-US": 1, "zh-CN": 2 },
      tag: { createdAt: new Date("2026-06-13T08:00:00.000Z"), id: 1 },
      translations: [
        { locale: "zh-CN", name: "Linux", slug: "linux", tagId: 1 },
        { locale: "en-US", name: "Linux", slug: "linux", tagId: 1 }
      ]
    }]);
    const enHtml = renderTagCards("en-US", [{
      articleCounts: { "en-US": 1, "zh-CN": 2 },
      tag: { createdAt: new Date("2026-06-13T08:00:00.000Z"), id: 1 },
      translations: [
        { locale: "zh-CN", name: "Linux", slug: "linux", tagId: 1 },
        { locale: "en-US", name: "Linux", slug: "linux", tagId: 1 }
      ]
    }]);

    assert.match(zhHtml, /2 篇文章/);
    assert.match(enHtml, /1 article/);
  });

  it("renders archive month article counts like the legacy archive page", () => {
    const zhHtml = renderArchiveBody("zh-CN", "zh", [
      createSearchResult({ articleId: 1, slug: "first", title: "第一篇" }),
      createSearchResult({ articleId: 2, slug: "second", title: "第二篇", publishedAt: new Date("2026-05-20T08:00:00.000Z") })
    ]);
    const enHtml = renderArchiveBody("en-US", "en", [
      createSearchResult({
        articleId: 3,
        locale: "en-US",
        publishedAt: new Date("2026-06-01T08:00:00.000Z"),
        slug: "third",
        title: "Third article"
      })
    ]);

    assert.match(zhHtml, /<span>2026-05<\/span><small>2 篇文章<\/small>/);
    assert.match(enHtml, /<span>2026-06<\/span><small>1 article<\/small>/);
  });
});
