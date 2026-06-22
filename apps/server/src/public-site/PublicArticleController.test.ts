import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SearchResult } from "../search/SearchService.js";
import {
  PublicArticleController,
  patchPublishedArticleHtml,
  renderArchiveBody,
  renderArticleCards,
  renderContactBody,
  renderGuestbookBody,
  renderHomePage,
  renderMomentsBody,
  renderPublicSectionPage,
  renderTagCards
} from "./PublicArticleController.js";

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
    visitCount: 0,
    ...overrides
  };
}

function visibleHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/giu, "").replace(/<style[\s\S]*?<\/style>/giu, "");
}

describe("public home page rendering", () => {
  it("renders only contact methods in the home page side panel", () => {
    const html = renderHomePage("zh-CN", "zh", {
      "home.contactItems.zh-CN": "邮箱:contact@liax.space\n主页:https://liax.example"
    });

    assert.match(html, /<aside class="liax-home-contact"/);
    assert.match(html, /href="mailto:contact@liax\.space"/);
    assert.match(html, /href="https:\/\/liax\.example"/);
    assert.doesNotMatch(html, /<nav class="liax-home-entry-grid"/);
    assert.doesNotMatch(html, /href="\/zh\/contact"/);
  });

  it("renders locale-specific contact settings on the home page", () => {
    const zhHtml = renderHomePage("zh-CN", "zh", {
      "home.contactItems.en-US": "Email:hello@liax.space\nWebsite:https://en.liax.example",
      "home.contactItems.zh-CN": "邮箱:contact@liax.space\n主页:https://zh.liax.example"
    });
    const enHtml = renderHomePage("en-US", "en", {
      "home.contactItems.en-US": "Email:hello@liax.space\nWebsite:https://en.liax.example",
      "home.contactItems.zh-CN": "邮箱:contact@liax.space\n主页:https://zh.liax.example"
    });

    assert.match(visibleHtml(zhHtml), /contact@liax\.space/);
    assert.match(visibleHtml(zhHtml), /https:\/\/zh\.liax\.example/);
    assert.doesNotMatch(visibleHtml(zhHtml), /Website/);
    assert.match(visibleHtml(enHtml), /hello@liax\.space/);
    assert.match(visibleHtml(enHtml), /https:\/\/en\.liax\.example/);
    assert.doesNotMatch(visibleHtml(enHtml), /邮箱/);
  });

  it("keeps legacy contact settings off the English home page", () => {
    const html = renderHomePage("en-US", "en", {
      "home.contactItems": "邮箱:hello@example.com\nQQ:123456"
    });

    assert.doesNotMatch(visibleHtml(html), /Email/);
    assert.doesNotMatch(visibleHtml(html), /QQ/);
    assert.doesNotMatch(visibleHtml(html), /邮箱/);
  });

  it("does not render the legacy author chip on the home page", () => {
    const html = renderHomePage("zh-CN", "zh", {
      "home.brandInfo": "Liax Space",
      "home.signature": "Timeless Silent Vigil"
    });

    assert.doesNotMatch(html, /liax-home-author/);
    assert.doesNotMatch(html, /作者\s*·\s*Liax/);
    assert.doesNotMatch(html, /Author\s*·\s*Liax/i);
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

  it("does not render placeholder contact methods or filing numbers on public pages", () => {
    const zhHome = renderHomePage("zh-CN", "zh", {
      "home.icpNumber": "ICP备案号"
    });
    const enHome = renderHomePage("en-US", "en", {
      "home.icpNumber": "备案号待配置"
    });
    const contactBody = renderContactBody("zh-CN", {
      "home.contactItems.zh-CN": "邮箱:hello@example.com\nQQ:123456"
    });

    assert.doesNotMatch(zhHome, /ICP备案号/);
    assert.doesNotMatch(enHome, /备案号待配置/);
    assert.doesNotMatch(contactBody, /hello@example\.com/);
    assert.doesNotMatch(contactBody, /123456/);
    assert.match(contactBody, /暂未配置公开联系方式/);
  });

  it("keeps the public home page on the warm design system contract", () => {
    const html = renderHomePage("en-US", "en", {});

    assert.match(html, /--color-page: #faf9f5/);
    assert.match(html, /--color-text: #141413/);
    assert.match(html, /height: 76px/);
    assert.match(html, /data-language-switch-placeholder="true"/);
    assert.match(html, /node\.style\.transition = "opacity 80ms ease"/);
    assert.doesNotMatch(html, /clip-path/i);
    assert.match(html, /class="liax-public-avatar"/);
    assert.match(html, /<a class="liax-public-avatar" href="\/console" aria-label="Console"/);
    assert.match(html, /data-public-search-overlay-trigger/);
    assert.match(html, /class="liax-public-search-form liax-public-search-form--inline"/);
    assert.match(html, /class="liax-public-search-form liax-public-search-form--sidebar"/);
    assert.match(html, /class="liax-home-contact"/);
    assert.match(html, /width: min\(1560px, calc\(100% - clamp\(24px, 5vw, 80px\)\)\)/);
    assert.match(html, /data-public-sidebar-toggle/);
    assert.doesNotMatch(html, /href="\/en\/contact"/);
    assert.doesNotMatch(html, /href="\/en\/account"/);
    assert.doesNotMatch(html, /background-image:\s*url\(/i);
    assert.doesNotMatch(html, /linear-gradient\([^)]*(blue|purple|violet)/i);
  });

  it("renders configured public logo, favicon, avatar, and theme preset colors", () => {
    const html = renderHomePage("zh-CN", "zh", {
      "site.logoAlt": "Liax Space custom logo",
      "site.logoUrl": "https://example.com/logo.png",
      "theme.preset": "quiet-garden"
    }, "/uploads/avatar.png");

    assert.match(html, /<link rel="icon" href="https:\/\/example\.com\/logo\.png">/);
    assert.match(html, /<link rel="apple-touch-icon" href="https:\/\/example\.com\/logo\.png">/);
    assert.match(html, /<meta property="og:image" content="https:\/\/example\.com\/logo\.png">/);
    assert.match(html, /<meta property="og:image:alt" content="Liax Space custom logo">/);
    assert.match(html, /<meta name="twitter:image" content="https:\/\/example\.com\/logo\.png">/);
    assert.match(html, /<span class="liax-public-logo"><img alt="Liax Space custom logo" onerror="this\.remove\(\)" src="https:\/\/example\.com\/logo\.png"><\/span>/);
    assert.match(html, /<a class="liax-public-avatar" href="\/console" aria-label="Console"><span aria-hidden="true">A<\/span><img alt="" onerror="this\.remove\(\)" src="\/uploads\/avatar\.png"><\/a>/);
    assert.match(html, /--color-primary: #102316;/);
    assert.match(html, /--color-brand: #3f6b4a;/);
  });
});

describe("public section page rendering", () => {
  it("patches old published article HTML so mobile content cannot widen the viewport", () => {
    const patched = patchPublishedArticleHtml(
      `<!doctype html>
<html lang="zh-CN">
<head>
  <link rel="icon" href="/favicon.svg">
  <style>
    .liax-article-card { width: 100%; padding: 68px; }
  </style>
</head>
<body>
  <div class="liax-public-shell">
    <header class="liax-public-header">
      <span class="liax-public-logo" aria-hidden="true">LS</span>
      <nav class="liax-language-switch" data-language-switch-placeholder="true"></nav>
      <a class="liax-public-avatar" href="/console" aria-label="Console">A</a>
    </header>
    <main class="liax-article-card">
      <header class="liax-article-header"><h1>旧模板长文章标题</h1></header>
      <article class="liax-article-body"><p>averyveryveryverylongwordwithoutbreaks</p><pre><code>const answer = 42;</code></pre><table><tbody><tr><td>wide table cell</td></tr></tbody></table></article>
    </main>
  </div>
</body>
</html>`,
      {},
      null
    );

    assert.match(patched, /\*,\s*\*::before,\s*\*::after\s*\{[\s\S]*?box-sizing: border-box;/);
    assert.match(patched, /html,\s*body\s*\{[\s\S]*?overflow-x: hidden;/);
    assert.match(patched, /\.liax-public-header,\s*\.liax-article-card\s*\{[\s\S]*?max-width: 100vw;/);
    assert.match(patched, /\.liax-article-card\s*\{[\s\S]*?overflow-x: clip;/);
    assert.match(patched, /<div class="liax-table-scroll"><table><tbody><tr><td>wide table cell<\/td><\/tr><\/tbody><\/table><\/div>/);
    assert.match(patched, /\.liax-article-body\s*\{[\s\S]*?overflow-x: auto;[\s\S]*?-webkit-overflow-scrolling: touch;/);
    assert.match(patched, /\.liax-table-scroll table\s*\{[\s\S]*?width: max-content;[\s\S]*?max-width: none;/);
    assert.match(patched, /\.liax-article-header h1,[\s\S]*?\.liax-article-body p,[\s\S]*?overflow-wrap: anywhere;/);
    assert.match(patched, /\.liax-article-body h2,[\s\S]*?scroll-margin-top: 96px;/);
    assert.match(patched, /function liaxHighlightCodeElement\(code\)/);
    assert.match(patched, /liaxHighlightCodeElement\(code\);/);
    assert.match(patched, /function liaxSetupReadingScrollbar\(\)/);
    assert.match(patched, /className = "liax-article-toc-toggle"/);
    assert.match(patched, /document\.body\.append\(nav\);/);
  });

  it("keeps only one language switch in patched article headers", () => {
    const patched = patchPublishedArticleHtml(
      `<!doctype html>
<html lang="zh-CN">
<head>
  <link rel="icon" href="/favicon.svg">
  <style></style>
</head>
<body>
  <div class="liax-public-shell">
    <header class="liax-public-header">
      <span class="liax-public-logo" aria-hidden="true">LS</span>
      <nav class="liax-language-switch" data-language-switch-placeholder="true"><a data-locale-target="en-US" href="/en/posts/a">EN</a></nav>
      <nav class="liax-language-switch" data-language-switch-placeholder="true"><a data-locale-target="en-US" href="/en/posts/a">EN duplicate</a></nav>
      <a class="liax-public-avatar" href="/console" aria-label="Console">A</a>
    </header>
    <main class="liax-article-card"><article class="liax-article-body"><p>正文</p></article></main>
  </div>
</body>
</html>`,
      {},
      null
    );

    assert.equal((patched.match(/class="liax-language-switch"/g) ?? []).length, 1);
    assert.doesNotMatch(patched, /EN duplicate/);
  });

  it("marks the posts tab active in patched legacy article menus", () => {
    const patched = patchPublishedArticleHtml(
      `<!doctype html>
<html lang="zh-CN">
<head>
  <link rel="icon" href="/favicon.svg">
  <style></style>
</head>
<body>
  <div class="liax-public-shell">
    <header class="liax-public-header">
      <nav class="liax-public-menu" aria-label="Primary">
        <a href="/zh" aria-current="page">首页</a>
        <a href="/zh/posts">文章</a>
        <a href="/zh/archives">归档</a>
      </nav>
      <nav class="liax-public-sidebar-menu" aria-label="Sidebar">
        <a href="/zh">首页</a>
        <a href="/zh/posts">文章</a>
        <a href="/zh/archives" aria-current="page">归档</a>
      </nav>
    </header>
    <main class="liax-article-card"><article class="liax-article-body"><p>正文</p></article></main>
  </div>
</body>
</html>`,
      {},
      null,
      {
        locale: "zh-CN",
        newerArticle: null,
        olderArticle: null,
        prefix: "zh",
        publishedAt: null,
        tags: [],
        visitCount: 0
      }
    );

    assert.equal((patched.match(/href="\/zh\/posts" aria-current="page"/g) ?? []).length, 2);
    assert.doesNotMatch(patched, /href="\/zh" aria-current="page"/);
    assert.doesNotMatch(patched, /href="\/zh\/archives" aria-current="page"/);
  });

  it("patches old published article chrome with configured logo, favicon, and avatar", () => {
    const patched = patchPublishedArticleHtml(
      `<!doctype html>
<html lang="zh-CN">
<head>
  <link rel="icon" href="/favicon.svg">
  <style></style>
</head>
<body>
  <div class="liax-public-shell">
    <header class="liax-public-header">
      <span class="liax-public-logo" aria-hidden="true">LS</span>
      <a class="liax-public-avatar" href="/console" aria-label="Console">A</a>
    </header>
    <main class="liax-article-card"><article class="liax-article-body"><p>正文</p></article></main>
  </div>
</body>
</html>`,
      {
        "site.logoAlt": "Published logo",
        "site.logoUrl": "/uploads/site-logo.png"
      },
      "/uploads/profile-avatar.webp"
    );

    assert.match(patched, /<link rel="icon" href="\/uploads\/site-logo\.png">/);
    assert.match(patched, /<meta property="og:image" content="\/uploads\/site-logo\.png">/);
    assert.match(patched, /<meta name="twitter:image" content="\/uploads\/site-logo\.png">/);
    assert.match(patched, /<span class="liax-public-logo"><img alt="Published logo" onerror="this\.remove\(\)" src="\/uploads\/site-logo\.png"><\/span>/);
    assert.match(patched, /<a class="liax-public-avatar" href="\/console" aria-label="Console"><span aria-hidden="true">A<\/span><img alt="" onerror="this\.remove\(\)" src="\/uploads\/profile-avatar\.webp"><\/a>/);
    assert.doesNotMatch(patched, /class="liax-public-avatar"[^>]*>A<\/a>/);
  });

  it("adds article metadata, tags, and neighbor navigation to old published article HTML", () => {
    const patched = patchPublishedArticleHtml(
      `<!doctype html>
<html lang="zh-CN">
<head>
  <link rel="icon" href="/favicon.svg">
  <style>.liax-article-utility { display: flex; }</style>
</head>
<body>
  <div class="liax-public-shell">
    <header class="liax-public-header">
      <span class="liax-public-logo" aria-hidden="true">LS</span>
      <nav class="liax-language-switch" data-language-switch-placeholder="true"></nav>
      <a class="liax-public-avatar" href="/console" aria-label="Console">A</a>
    </header>
    <main class="liax-article-card">
      <header class="liax-article-header"><h1>旧模板长文章标题</h1></header>
      <article class="liax-article-body"><p>正文</p></article>
    </main>
  </div>
</body>
</html>`,
      {},
      null,
      {
        allowedRoles: ["svip"],
        locale: "zh-CN",
        newerArticle: createSearchResult({ slug: "newer", title: "下一篇文章", url: "/zh/posts/newer" }),
        olderArticle: createSearchResult({ slug: "older", title: "上一篇文章", url: "/zh/posts/older" }),
        prefix: "zh",
        publishedAt: new Date("2026-05-10T08:00:00.000Z"),
        tags: [
          { name: "Linux", slug: "linux" },
          { name: "长标签", slug: "long-tag" }
        ],
        visitCount: 7
      }
    );

    assert.match(patched, /<h1>旧模板长文章标题<\/h1>/);
    assert.match(patched, /href="\/zh\/posts">返回文章列表<\/a>/);
    assert.match(patched, /<span>发布时间<\/span><time datetime="2026-05-10">2026-05-10<\/time>/);
    assert.match(patched, /<span>7 阅读<\/span>/);
    assert.match(patched, /<p class="liax-article-audience"><span>可见范围<\/span><strong>SVIP 及以上<\/strong><\/p>/);
    assert.match(patched, /class="liax-article-tags" aria-label="文章标签"/);
    assert.match(patched, /href="\/zh\/tags\/linux"><span aria-hidden="true">#<\/span>Linux<\/a>/);
    assert.match(patched, /href="\/zh\/tags\/long-tag"><span aria-hidden="true">#<\/span>长标签<\/a>/);
    assert.match(patched, /<span>上一篇<\/span><strong>上一篇文章<\/strong>/);
    assert.match(patched, /<span>下一篇<\/span><strong>下一篇文章<\/strong>/);
    assert.match(patched, /<footer class="liax-article-footer">[\s\S]*class="liax-article-neighbor-nav"/);
    assert.ok(patched.indexOf('class="liax-article-neighbor-nav"') > patched.indexOf('</article>'));
  });

  it("formats article published dates with the public site calendar day", () => {
    const patched = patchPublishedArticleHtml(
      `<!doctype html>
<html lang="zh-CN">
<head>
  <link rel="icon" href="/favicon.svg">
  <style></style>
</head>
<body>
  <main class="liax-article-card">
    <header class="liax-article-header"><h1>北京时间零点发布</h1></header>
    <article class="liax-article-body"><p>正文</p></article>
  </main>
</body>
</html>`,
      {},
      null,
      {
        allowedRoles: [],
        locale: "zh-CN",
        newerArticle: null,
        olderArticle: null,
        prefix: "zh",
        publishedAt: new Date("2026-05-09T16:00:00.000Z"),
        tags: [],
        visitCount: 0
      }
    );

    assert.match(patched, /<span>发布时间<\/span><time datetime="2026-05-10">2026-05-10<\/time>/);
  });

  it("moves legacy neighbor navigation to the end of the article", () => {
    const patched = patchPublishedArticleHtml(
      `<!doctype html>
<html lang="zh-CN">
<head>
  <link rel="icon" href="/favicon.svg">
  <style></style>
</head>
<body>
  <div class="liax-public-shell">
    <header class="liax-public-header">
      <span class="liax-public-logo" aria-hidden="true">LS</span>
      <a class="liax-public-avatar" href="/console" aria-label="Console">A</a>
    </header>
    <main class="liax-article-card">
      <header class="liax-article-header"><h1>Legacy</h1><nav class="liax-article-neighbor-nav" aria-label="Neighbor articles"><a href="/zh/posts/old"><span>Previous</span><strong>Old</strong></a></nav></header>
      <article class="liax-article-body"><p>Body</p></article>
    </main>
  </div>
</body>
</html>`,
      {},
      null
    );

    assert.equal((patched.match(/class="liax-article-neighbor-nav"/g) ?? []).length, 1);
    assert.ok(patched.indexOf('class="liax-article-neighbor-nav"') > patched.indexOf('</article>'));
    assert.match(patched, /<footer class="liax-article-footer">[\s\S]*class="liax-article-neighbor-nav"/);
  });

  it("renders language-prefixed section pages with alternate links", () => {
    const html = renderPublicSectionPage("en-US", "en", "posts");

    assert.match(html, /<html lang="en-US">/);
    assert.match(html, /<link rel="canonical" href="\/en\/posts">/);
    assert.match(html, /<link rel="alternate" hreflang="zh-CN" href="\/zh\/posts">/);
    assert.match(html, /Articles · Liax Space/);
    assert.match(html, /data-language-switch-placeholder="true"/);
    assert.match(html, /<a class="liax-public-avatar" href="\/console" aria-label="Console"/);
    assert.match(html, /data-public-search-overlay-trigger/);
    assert.doesNotMatch(html, /href="\/en\/contact"/);
    assert.match(html, /width: min\(1440px, calc\(100% - clamp\(24px, 5vw, 80px\)\)\)/);
  });

  it("redirects unfinished public account pages to the console", async () => {
    const controller = new PublicArticleController();
    const redirected: { status?: number; url?: string } = {};
    const response = {
      redirect(status: number, url: string) {
        redirected.status = status;
        redirected.url = url;
        return response;
      }
    };

    await controller.getSection(
      { params: { localePrefix: "zh", section: "account" } } as never,
      response as never
    );

    assert.deepEqual(redirected, { status: 302, url: "/console" });
  });

  it("applies configured public logo, favicon, avatar, and theme settings to section pages", () => {
    const html = renderPublicSectionPage("en-US", "en", "tags", undefined, {
      "site.logoAlt": "Section logo",
      "site.logoUrl": "https://example.com/section-logo.png",
      "theme.preset": "clear-graphite"
    }, "/uploads/avatar-section.png");

    assert.match(html, /<link rel="icon" href="https:\/\/example\.com\/section-logo\.png">/);
    assert.match(html, /<link rel="apple-touch-icon" href="https:\/\/example\.com\/section-logo\.png">/);
    assert.match(html, /<meta property="og:image" content="https:\/\/example\.com\/section-logo\.png">/);
    assert.match(html, /<meta name="twitter:image" content="https:\/\/example\.com\/section-logo\.png">/);
    assert.match(html, /<span class="liax-public-logo"><img alt="Section logo" onerror="this\.remove\(\)" src="https:\/\/example\.com\/section-logo\.png"><\/span>/);
    assert.match(html, /<a class="liax-public-avatar" href="\/console" aria-label="Console"><span aria-hidden="true">A<\/span><img alt="" onerror="this\.remove\(\)" src="\/uploads\/avatar-section\.png"><\/a>/);
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
    assert.match(html, /class="liax-guestbook-layout"/);
    assert.match(html, /class="liax-guestbook-compose"/);
    assert.match(html, /class="liax-guestbook-stream"/);
    assert.match(html, /<textarea name="content" maxlength="1000" required rows="2"/);
    assert.match(html, /访客/);
    assert.match(html, /你好/);
    assert.doesNotMatch(html, /visitor@example\.test/);
  });

  it("renders public guestbook entries without hiding test-like author names", () => {
    const baseEntry = {
      content: "visible message",
      createdAt: new Date("2026-06-13T08:00:00.000Z"),
      deletedAt: null,
      email: "visitor@example.test",
      id: 1,
      isPublic: true,
      locale: "zh-CN" as const,
      notifyOnly: false
    };
    const html = renderGuestbookBody("zh-CN", "zh", [
      { ...baseEntry, authorName: "AutoTestBot", content: "automated public test", id: 1 },
      { ...baseEntry, authorName: "QA user", content: "qa public test", id: 2 },
      { ...baseEntry, authorName: "真实访客", content: "真实留言", id: 3 }
    ]);

    assert.match(html, /AutoTestBot/);
    assert.match(html, /QA user/);
    assert.match(html, /automated public test/);
    assert.match(html, /qa public test/);
    assert.match(html, /真实访客/);
    assert.match(html, /真实留言/);
  });

  it("keeps mojibake public guestbook entries visible with a repair note", () => {
    const html = renderGuestbookBody("zh-CN", "zh", [{
      authorName: "访客",
      content: "??????????????????",
      createdAt: new Date("2026-06-13T08:00:00.000Z"),
      deletedAt: null,
      email: null,
      id: 1,
      isPublic: true,
      locale: "zh-CN",
      notifyOnly: false
    }]);

    assert.match(html, /内容数据待修复/);
    assert.match(html, /这条留言内容待修复/);
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
    assert.match(html, /onerror="const p=this\.parentElement;this\.remove\(\);if\(p&&!p\.querySelector\('img'\)\)p\.remove\(\);"/);
  });

  it("omits unavailable local moment images before rendering", () => {
    const html = renderMomentsBody("zh-CN", [{
      authorId: null,
      content: "带缺失图片的瞬间",
      createdAt: new Date("2026-06-13T08:00:00.000Z"),
      deletedAt: null,
      id: 1,
      images: ["/uploads/missing.png", "/uploads/available.png"],
      locale: "zh-CN",
      publishedAt: new Date("2026-06-13T08:00:00.000Z"),
      status: "published",
      updatedAt: new Date("2026-06-13T08:00:00.000Z")
    }], {
      shouldRenderImage: (image) => image.endsWith("available.png")
    });

    assert.match(html, /class="liax-moment-images"/);
    assert.doesNotMatch(html, /missing\.png/);
    assert.match(html, /available\.png/);
  });

  it("removes the moment image grid when every image is unavailable", () => {
    const html = renderMomentsBody("zh-CN", [{
      authorId: null,
      content: "只有缺失图片的瞬间",
      createdAt: new Date("2026-06-13T08:00:00.000Z"),
      deletedAt: null,
      id: 1,
      images: ["/uploads/missing-a.png", "/uploads/missing-b.png"],
      locale: "zh-CN",
      publishedAt: new Date("2026-06-13T08:00:00.000Z"),
      status: "published",
      updatedAt: new Date("2026-06-13T08:00:00.000Z")
    }], {
      shouldRenderImage: () => false
    });

    assert.doesNotMatch(html, /class="liax-moment-images"/);
    assert.doesNotMatch(html, /missing-a\.png/);
    assert.match(html, /只有缺失图片的瞬间/);
  });

  it("renders public tag counts, hides empty tags, and prioritizes active tags", () => {
    const tagDetails: Parameters<typeof renderTagCards>[1] = [{
      articleCounts: { "en-US": 1, "zh-CN": 2 },
      tag: { createdAt: new Date("2026-06-13T08:00:00.000Z"), id: 1 },
      translations: [
        { locale: "zh-CN", name: "Linux", slug: "linux", tagId: 1 },
        { locale: "en-US", name: "Linux", slug: "linux", tagId: 1 }
      ]
    }, {
      articleCounts: { "en-US": 0, "zh-CN": 0 },
      tag: { createdAt: new Date("2026-06-13T08:00:00.000Z"), id: 2 },
      translations: [
        { locale: "zh-CN", name: "空标签", slug: "empty", tagId: 2 },
        { locale: "en-US", name: "Empty", slug: "empty", tagId: 2 }
      ]
    }, {
      articleCounts: { "en-US": 3, "zh-CN": 5 },
      tag: { createdAt: new Date("2026-06-12T08:00:00.000Z"), id: 3 },
      translations: [
        { locale: "zh-CN", name: "AI", slug: "ai", tagId: 3 },
        { locale: "en-US", name: "AI", slug: "ai", tagId: 3 }
      ]
    }, {
      articleCounts: { "en-US": 2, "zh-CN": 2 },
      tag: { createdAt: new Date("2026-06-14T08:00:00.000Z"), id: 4 },
      translations: [
        { locale: "zh-CN", name: "DevOps", slug: "devops", tagId: 4 },
        { locale: "en-US", name: "DevOps", slug: "devops", tagId: 4 }
      ]
    }];
    const zhHtml = renderTagCards("zh-CN", tagDetails);
    const enHtml = renderTagCards("en-US", tagDetails);

    assert.match(zhHtml, /5 篇文章/);
    assert.match(enHtml, /3 articles/);
    assert.doesNotMatch(zhHtml, /空标签/);
    assert.doesNotMatch(enHtml, /Empty/);
    assert.ok(zhHtml.indexOf("/zh/tags/ai") < zhHtml.indexOf("/zh/tags/devops"));
    assert.ok(zhHtml.indexOf("/zh/tags/devops") < zhHtml.indexOf("/zh/tags/linux"));
    assert.match(zhHtml, /liax-tag-grid__link liax-tag-grid__link--featured/);
    assert.match(zhHtml, /<em class="liax-tag-grid__badge">热门<\/em>/);
    assert.match(zhHtml, /<em class="liax-tag-grid__badge">活跃<\/em>/);
    assert.match(enHtml, /<em class="liax-tag-grid__badge">Popular<\/em>/);
    assert.match(enHtml, /<em class="liax-tag-grid__badge">Active<\/em>/);
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

  it("renders article card read counts like the legacy article list", () => {
    const html = renderArticleCards("zh-CN", "zh", [
      createSearchResult({ slug: "read-count", title: "有阅读数的文章", visitCount: 4 })
    ], "空");

    assert.match(html, /<span>4 阅读<\/span>/);
    assert.match(html, /class="liax-article-meta"/);

    const page = renderPublicSectionPage("zh-CN", "zh", "posts", html);
    assert.match(page, /grid-template-columns: minmax\(0, 1fr\) max-content/);
    assert.match(page, /transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease/);
  });

  it("renders a dedicated contact section from site settings", () => {
    const body = renderContactBody("zh-CN", {
      "home.contactItems.zh-CN": "邮箱:contact@liax.space\n主页:https://liax.example"
    });
    const page = renderPublicSectionPage("zh-CN", "zh", "contact", body);

    assert.match(page, /<title>联系 · Liax Space<\/title>/);
    assert.match(page, /href="\/zh\/contact"/);
    assert.match(page, /href="mailto:contact@liax\.space"/);
    assert.match(page, /href="https:\/\/liax\.example"/);
    assert.match(page, /这些联系方式由站点设置统一维护/);
  });
});
