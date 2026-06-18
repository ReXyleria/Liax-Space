import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { renderLanguageSwitchScript } from "../renderer/TemplateRenderer.js";
import { SettingsRepository } from "../settings/SettingsRepository.js";
import type { SiteSettings } from "../settings/settings.types.js";
import { UserRepository } from "../users/UserRepository.js";
import { SearchService } from "./SearchService.js";
import type { SearchResult } from "./SearchService.js";

const searchService = new SearchService();
const settingsRepository = new SettingsRepository();
const userRepository = new UserRepository();

export const searchRoutes = Router();

function requireAuth(request: { auth?: { role: string } }) {
  if (!request.auth) {
    throw new AppError("Authentication required.", {
      code: errorCodes.unauthorized,
      statusCode: 401
    });
  }

  return request.auth;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function readStringSetting(settings: SiteSettings, key: string, fallback: string): string {
  const value = settings[key];

  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isPublicAssetUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//") && !/[\u0000-\u001f]/u.test(value)) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function readLogoUrl(settings: SiteSettings): string | null {
  const value = settings["site.logoUrl"];

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const normalized = value.trim();
  return isPublicAssetUrl(normalized) ? normalized : null;
}

function renderFaviconLink(settings: SiteSettings): string {
  const logoUrl = readLogoUrl(settings);
  return `<link rel="icon" href="${escapeHtml(logoUrl ?? "/favicon.svg")}">`;
}

function renderPublicLogo(settings: SiteSettings): string {
  const logoUrl = readLogoUrl(settings);
  const logoAlt = readStringSetting(settings, "site.logoAlt", "Liax Space");

  if (!logoUrl) {
    return `<span class="liax-public-logo" aria-hidden="true">LS</span>`;
  }

  return `<span class="liax-public-logo"><img alt="${escapeHtml(logoAlt)}" src="${escapeHtml(logoUrl)}"></span>`;
}

function renderPublicAvatar(avatarUrl: string | null): string {
  if (!avatarUrl || !isPublicAssetUrl(avatarUrl)) {
    return `<a class="liax-public-avatar" href="/console" aria-label="Console">A</a>`;
  }

  return `<a class="liax-public-avatar" href="/console" aria-label="Console"><img alt="" src="${escapeHtml(avatarUrl)}"></a>`;
}

function readCodeInjection(settings: SiteSettings, key: "codeInjection.footer" | "codeInjection.globalHead"): string {
  const value = settings[key];

  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function renderGlobalHeadInjection(settings: SiteSettings): string {
  const injection = readCodeInjection(settings, "codeInjection.globalHead");

  return injection ? `${injection}\n` : "";
}

function renderFooterInjection(settings: SiteSettings): string {
  const injection = readCodeInjection(settings, "codeInjection.footer");

  return injection ? `\n${injection}` : "";
}

async function readPublicAvatarUrl(): Promise<string | null> {
  const adminUser = await userRepository.findAdminUser();

  if (!adminUser) {
    return null;
  }

  const preferences = await settingsRepository.getUserPreferences(adminUser.id);
  const avatarUrl = preferences?.avatarPublicUrl ?? null;

  return avatarUrl && isPublicAssetUrl(avatarUrl) ? avatarUrl : null;
}

function formatVisitCount(localePrefix: "zh" | "en", count: number): string {
  if (localePrefix === "zh") {
    return `${count} 阅读`;
  }

  return `${count} ${count === 1 ? "read" : "reads"}`;
}

export function shouldRenderPublicSearchHtml(acceptHeader: string | undefined): boolean {
  if (!acceptHeader || acceptHeader.trim() === "") {
    return true;
  }

  const normalized = acceptHeader.toLowerCase();

  if (normalized.includes("text/html")) {
    return true;
  }

  if (normalized.includes("application/json")) {
    return false;
  }

  return true;
}

function searchQuerySuffix(query: string): string {
  const params = new URLSearchParams();

  if (query.trim()) {
    params.set("q", query.trim());
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function renderSearchLanguageSwitch(localePrefix: "zh" | "en", query: string): string {
  const targetPrefix = localePrefix === "zh" ? "en" : "zh";
  const targetLocale = targetPrefix === "zh" ? "zh-CN" : "en-US";
  const label = targetLocale === "zh-CN" ? "切换到中文" : "Switch to English";
  const visibleLabel = targetLocale === "zh-CN" ? "中" : "EN";

  return `<nav class="liax-language-switch" aria-label="Language switch" data-language-switch-placeholder="true">
        <a class="liax-button liax-language-icon-button" aria-label="${label}" data-locale-target="${targetLocale}" href="/${targetPrefix}/search${searchQuerySuffix(query)}">
          <span aria-hidden="true">${visibleLabel}</span>
        </a>
      </nav>`;
}

function renderPublicMenuLinks(localePrefix: "zh" | "en", isZh: boolean): string {
  return `<a href="/${localePrefix}">${isZh ? "首页" : "Home"}</a>
          <a href="/${localePrefix}/posts">${isZh ? "文章" : "Articles"}</a>
          <a href="/${localePrefix}/tags">${isZh ? "标签" : "Tags"}</a>
          <a href="/${localePrefix}/moments">${isZh ? "瞬间" : "Moments"}</a>
          <a href="/${localePrefix}/guestbook">${isZh ? "留言" : "Guestbook"}</a>
          <a href="/${localePrefix}/archives">${isZh ? "归档" : "Archives"}</a>`;
}

function renderPublicSearchForm(localePrefix: "zh" | "en", isZh: boolean, variant: "inline" | "sidebar", query = ""): string {
  const title = isZh ? "搜索" : "Search";

  return `<form class="liax-public-search-form liax-public-search-form--${variant}" action="/${localePrefix}/search" method="get" role="search">
          <input class="liax-public-search" aria-label="${title}" data-public-search-overlay-trigger name="q" type="search" placeholder="${title}" value="${escapeHtml(query)}">
        </form>`;
}

function renderPublicMenuToggle(isZh: boolean): string {
  const label = isZh ? "展开导航" : "Open navigation";

  return `<button class="liax-public-menu-toggle" type="button" aria-label="${label}" aria-expanded="false" data-public-sidebar-toggle>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </button>`;
}

function renderPublicSidebar(localePrefix: "zh" | "en", isZh: boolean, query: string): string {
  const closeLabel = isZh ? "关闭导航" : "Close navigation";

  return `<div class="liax-public-sidebar-layer" aria-hidden="true" inert data-public-sidebar-layer>
      <button class="liax-public-sidebar-backdrop" type="button" aria-label="${closeLabel}" data-public-sidebar-close></button>
      <aside class="liax-public-sidebar" aria-label="${closeLabel}">
        ${renderPublicSearchForm(localePrefix, isZh, "sidebar", query)}
        <nav class="liax-public-sidebar-menu" aria-label="Primary">
          ${renderPublicMenuLinks(localePrefix, isZh)}
        </nav>
      </aside>
    </div>`;
}

export function renderPublicSearchPage(
  localePrefix: "zh" | "en",
  query: string,
  results: SearchResult[],
  settings: SiteSettings = {},
  avatarUrl: string | null = null
): string {
  const isZh = localePrefix === "zh";
  const title = isZh ? "搜索" : "Search";
  const empty = isZh
    ? "没有找到匹配结果。搜索范围包含已发布文章的标题、摘要、正文、标签和分类；可以换一个关键词，或返回文章列表继续浏览。"
    : "No matching results found. Search covers published article titles, summaries, body text, tags, and categories. Try another keyword or return to the article list.";
  const resultLabel = isZh ? "搜索结果" : "Search results";
  const alternatePrefix = localePrefix === "zh" ? "en" : "zh";
  const alternateLocale = alternatePrefix === "zh" ? "zh-CN" : "en-US";
  const querySuffix = searchQuerySuffix(query);

  return `<!doctype html>
<html lang="${isZh ? "zh-CN" : "en-US"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="/${localePrefix}/search${querySuffix}">
  <link rel="alternate" hreflang="${alternateLocale}" href="/${alternatePrefix}/search${querySuffix}">
  ${renderFaviconLink(settings)}
  ${renderGlobalHeadInjection(settings)}
  <title>${title} · Liax Space</title>
  <style>
    :root {
      --color-page: #faf9f5;
      --color-surface: #ffffff;
      --color-surface-muted: #f5f4ed;
      --color-border: #d1cfc5;
      --color-text: #141413;
      --color-primary: #141413;
      --color-primary-text: #faf9f5;
      --color-brand: #c96442;
      --color-brand-text: #faf9f5;
      --color-accent: #d97757;
    }

    html,
    body {
      min-height: 100%;
      margin: 0;
      scrollbar-width: none;
      background: var(--color-page);
      color: var(--color-text);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      text-rendering: geometricPrecision;
      -webkit-font-smoothing: antialiased;
    }

    html {
      scrollbar-width: none;
    }

    html::-webkit-scrollbar,
    body::-webkit-scrollbar {
      display: none;
    }

    .liax-public-shell {
      box-sizing: border-box;
      display: grid;
      min-height: 100vh;
      grid-template-rows: auto 1fr;
      width: 100%;
      margin: 0;
      padding: 0;
    }

    .liax-public-header,
    .liax-search-card {
      animation: liax-page-enter 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .liax-search-card {
      animation-delay: 70ms;
    }

    .liax-public-header {
      box-sizing: border-box;
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr) max-content;
      align-items: center;
      gap: clamp(12px, 2vw, 24px);
      width: 100%;
      height: 76px;
      min-height: 76px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
      padding: 12px clamp(18px, 3vw, 40px);
      scrollbar-width: none;
    }

    .liax-public-header::-webkit-scrollbar {
      display: none;
    }

    .liax-public-brand,
    .liax-public-header__center,
    .liax-public-header__tools,
    .liax-public-menu,
    .liax-language-switch {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .liax-public-brand {
      color: var(--color-text);
      font-size: 17px;
      font-weight: 800;
      text-decoration: none;
      white-space: nowrap;
    }

    .liax-public-logo,
    .liax-public-avatar {
      display: inline-grid;
      place-items: center;
      border: 1px solid var(--color-border);
      border-radius: 999px;
    }

    .liax-public-logo {
      width: 34px;
      height: 34px;
      background: var(--color-primary);
      color: var(--color-primary-text);
      font-size: 12px;
      font-weight: 800;
      overflow: hidden;
    }

    .liax-public-logo img,
    .liax-public-avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .liax-public-header__center {
      display: grid;
      grid-template-columns: minmax(0, auto) 44px;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .liax-public-menu {
      display: grid;
      grid-template-columns: repeat(6, 86px);
      gap: 6px;
      justify-content: end;
      min-width: 0;
      position: relative;
      z-index: 1;
    }

    .liax-language-switch {
      flex: 0 0 auto;
      flex-wrap: nowrap;
      justify-content: center;
      position: relative;
      z-index: 2;
      width: 44px;
    }

    .liax-public-menu a {
      color: var(--color-text);
      flex: 0 0 auto;
      display: inline-flex;
      justify-content: center;
      width: 86px;
      padding: 6px 7px;
      font-size: 14px;
      font-weight: 760;
      text-decoration: none;
      white-space: nowrap;
    }

    .liax-public-menu a:hover,
    .liax-public-menu a:focus-visible {
      color: var(--color-accent);
      text-decoration: underline;
      text-underline-offset: 0.18em;
    }

    .liax-public-header__tools {
      justify-content: flex-end;
    }

    .liax-public-search-form--inline {
      display: flex;
    }

    .liax-public-search {
      box-sizing: border-box;
      width: min(210px, 20vw);
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface-muted);
      color: var(--color-text);
      padding: 8px 12px;
    }

    .liax-public-search-form {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .liax-public-menu-toggle {
      display: none;
      width: 38px;
      height: 38px;
      align-items: center;
      justify-content: center;
      gap: 3px;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface-muted);
      color: var(--color-text);
      cursor: pointer;
      padding: 0;
    }

    .liax-public-menu-toggle span {
      display: block;
      width: 4px;
      height: 4px;
      border-radius: 999px;
      background: currentColor;
    }

    .liax-public-sidebar-layer {
      position: fixed;
      inset: 0;
      z-index: 2147483644;
      opacity: 0;
      pointer-events: none;
      transition: opacity 220ms ease;
      visibility: hidden;
    }

    .liax-public-sidebar-layer.is-open {
      opacity: 1;
      pointer-events: auto;
      visibility: visible;
    }

    .liax-public-sidebar-backdrop {
      position: absolute;
      inset: 0;
      border: 0;
      background: rgba(20, 20, 19, 0.18);
      backdrop-filter: blur(10px);
      cursor: default;
      padding: 0;
    }

    .liax-public-sidebar {
      position: absolute;
      inset-block: 0;
      inset-inline-end: 0;
      display: grid;
      align-content: start;
      gap: 18px;
      box-sizing: border-box;
      width: min(360px, calc(100vw - 36px));
      border-left: 1px solid var(--color-border);
      background: var(--color-page);
      box-shadow: -18px 0 44px rgba(20, 20, 19, 0.14);
      padding: 24px;
      transform: translateX(100%);
      transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .liax-public-sidebar-layer.is-open .liax-public-sidebar {
      transform: translateX(0);
    }

    .liax-public-search-form--sidebar,
    .liax-public-sidebar-menu {
      display: grid;
      gap: 10px;
    }

    .liax-public-search-form--sidebar .liax-public-search {
      width: 100%;
      min-width: 0;
    }

    .liax-public-sidebar-menu a {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      color: var(--color-text);
      font-weight: 760;
      padding: 12px 14px;
      text-decoration: none;
    }

    .liax-public-sidebar-menu a:hover,
    .liax-public-sidebar-menu a:focus-visible {
      border-color: var(--color-accent);
      color: var(--color-accent);
      outline: 0;
    }

    .liax-public-avatar {
      text-decoration: none;
      width: 38px;
      height: 38px;
      background: var(--color-surface-muted);
      color: var(--color-text);
      font-weight: 800;
    }

    .liax-button {
      display: inline-flex;
      min-height: 38px;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface-muted);
      color: var(--color-text);
      font: inherit;
      font-size: 14px;
      font-weight: 760;
      padding: 7px 12px;
      text-decoration: none;
    }

    .liax-button--brand {
      border-color: var(--color-brand);
      background: var(--color-brand);
      color: var(--color-brand-text);
    }

    .liax-language-icon-button {
      width: 36px;
      height: 36px;
      flex: 0 0 36px;
      border-color: rgb(209 207 197 / 78%);
      border-radius: 999px;
      background: rgb(250 249 245 / 72%);
      color: rgb(20 20 19 / 82%);
      padding: 0;
      font-size: 12px;
      font-weight: 720;
    }

    .liax-search-page {
      box-sizing: border-box;
      width: min(1440px, calc(100% - clamp(32px, 6vw, 96px)));
      max-width: none;
      margin: 0 auto;
      padding: 24px 0 48px;
    }

    .liax-search-card,
    .liax-search-result {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      color: var(--color-text);
    }

    .liax-search-card {
      padding: 32px;
    }

    .liax-search-card h1 {
      margin: 0 0 18px;
      font-size: clamp(38px, 7vw, 76px);
      line-height: 1;
      letter-spacing: 0;
    }

    .liax-search-form {
      display: flex;
      gap: 10px;
      margin-bottom: 28px;
    }

    .liax-search-form input {
      flex: 1;
      min-width: 0;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface-muted);
      color: var(--color-text);
      padding: 10px 14px;
    }

    .liax-search-back {
      display: flex;
      width: max-content;
      max-width: 100%;
      align-items: center;
      min-height: 40px;
      border: 1px solid var(--color-primary);
      border-radius: 999px;
      background: var(--color-primary);
      color: var(--color-primary-text);
      font: inherit;
      font-weight: 760;
      margin-bottom: 18px;
      padding: 8px 14px;
      text-decoration: none;
    }

    .liax-search-results {
      display: grid;
      gap: 12px;
    }

    .liax-search-result {
      display: grid;
      gap: 8px;
      background: var(--color-surface-muted);
      padding: 16px;
    }

    .liax-search-result a {
      color: var(--color-text);
      font-size: 20px;
      font-weight: 800;
      text-decoration: none;
    }

    .liax-search-result a:hover,
    .liax-search-result a:focus-visible {
      color: var(--color-accent);
      text-decoration: underline;
      text-underline-offset: 0.18em;
    }

    .liax-search-result small {
      color: #6f6a5d;
      font-size: 13px;
      font-weight: 760;
    }

    .liax-search-empty {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface-muted);
      padding: 16px;
    }

    .liax-search-empty p {
      margin: 0 0 10px;
    }

    .liax-search-empty a {
      color: var(--color-accent);
      font-weight: 760;
      text-decoration: underline;
      text-underline-offset: 0.18em;
    }

    @keyframes liax-page-enter {
      from {
        opacity: 0;
        transform: translateY(12px);
      }

      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (max-width: 640px) {
      .liax-search-form {
        flex-direction: column;
      }
    }

    @media (max-width: 860px) {
      .liax-public-header {
        grid-template-columns: max-content minmax(0, 1fr) max-content;
        height: 76px;
        min-height: 76px;
        gap: 10px;
        overflow-x: auto;
        padding: 10px 14px;
      }

      .liax-public-header__center,
      .liax-public-header__tools {
        align-items: center;
        flex: 0 0 auto;
        flex-direction: row;
      }

      .liax-public-header__center {
        grid-template-columns: 44px;
        justify-content: end;
      }

      .liax-public-menu {
        display: none;
      }
    }

    @media (max-width: 1080px) {
      .liax-public-search-form--inline {
        display: none;
      }

      .liax-public-menu-toggle {
        display: inline-flex;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .liax-public-header,
      .liax-search-card {
        animation: none;
      }

      .liax-public-sidebar-layer,
      .liax-public-sidebar {
        transition: none;
      }
    }
  </style>
</head>
<body>
  <div class="liax-public-shell">
    <header class="liax-public-header">
      <a class="liax-public-brand" href="/${localePrefix}">
        ${renderPublicLogo(settings)}
        <span>Liax Space</span>
      </a>
      <div class="liax-public-header__center">
        <nav class="liax-public-menu" aria-label="Primary">
          ${renderPublicMenuLinks(localePrefix, isZh)}
        </nav>
        ${renderSearchLanguageSwitch(localePrefix, query)}
      </div>
      <div class="liax-public-header__tools">
        ${renderPublicSearchForm(localePrefix, isZh, "inline", query)}
        ${renderPublicMenuToggle(isZh)}
        ${renderPublicAvatar(avatarUrl)}
      </div>
    </header>
    ${renderPublicSidebar(localePrefix, isZh, query)}
    <main class="liax-search-page">
      <section class="liax-search-card">
        <a class="liax-search-back" href="/${localePrefix}">Liax Space</a>
        <h1>${title}</h1>
        <form class="liax-search-form" action="/${localePrefix}/search" method="get" role="search">
          <input aria-label="${title}" data-public-search-overlay-trigger name="q" type="search" value="${escapeHtml(query)}">
        </form>
        <h2>${resultLabel}</h2>
        ${results.length === 0 ? `<div class="liax-search-empty"><p>${empty}</p><a href="/${localePrefix}/posts">${isZh ? "返回文章列表" : "Back to articles"}</a></div>` : `<div class="liax-search-results">
${results.map((result) => `        <article class="liax-search-result">
          <a href="${escapeHtml(result.url ?? `/${localePrefix}`)}">${escapeHtml(result.title)}</a>
          <small>${escapeHtml(formatVisitCount(localePrefix, result.visitCount))}</small>
          ${result.summary ? `<p>${escapeHtml(result.summary)}</p>` : ""}
        </article>`).join("\n")}
        </div>`}
      </section>
    </main>
  </div>
${renderFooterInjection(settings)}
${renderLanguageSwitchScript()}
</body>
</html>`;
}

searchRoutes.get(
  "/:localePrefix/search",
  asyncHandler(async (request, response) => {
    const results = await searchService.searchPublic({
      category: request.query.category,
      keyword: request.query.keyword ?? request.query.q,
      limit: request.query.limit,
      localePrefix: request.params.localePrefix,
      offset: request.query.offset,
      tag: request.query.tag
    });

    if ((request.params.localePrefix === "zh" || request.params.localePrefix === "en") && shouldRenderPublicSearchHtml(request.headers.accept)) {
      const queryValue = Array.isArray(request.query.q) ? request.query.q[0] : request.query.q;
      const [settings, avatarUrl] = await Promise.all([
        settingsRepository.getSiteSettings(),
        readPublicAvatarUrl()
      ]);
      response.status(200).type("html").send(renderPublicSearchPage(
        request.params.localePrefix,
        typeof queryValue === "string" ? queryValue : "",
        results,
        settings,
        avatarUrl
      ));
      return;
    }

    response.status(200).json({ results });
  })
);

searchRoutes.get(
  "/admin/articles/search",
  authRequired,
  asyncHandler(async (request, response) => {
    const auth = requireAuth(request);
    const results = await searchService.searchAdmin({
      category: request.query.category,
      keyword: request.query.keyword ?? request.query.q,
      limit: request.query.limit,
      locale: request.query.locale,
      offset: request.query.offset,
      role: auth.role,
      status: request.query.status,
      tag: request.query.tag
    });

    response.status(200).json({ results });
  })
);
