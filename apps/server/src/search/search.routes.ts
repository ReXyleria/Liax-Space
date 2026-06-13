import { Router } from "express";

import { asyncHandler } from "../common/asyncHandler.js";
import { authRequired } from "../common/authRequired.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { renderLanguageSwitchScript } from "../renderer/TemplateRenderer.js";
import { SearchService } from "./SearchService.js";
import type { SearchResult } from "./SearchService.js";

const searchService = new SearchService();

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

function renderPublicSearchPage(localePrefix: "zh" | "en", query: string, results: SearchResult[]): string {
  const isZh = localePrefix === "zh";
  const title = isZh ? "搜索" : "Search";
  const empty = isZh ? "没有找到匹配结果。" : "No matching results found.";
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
      background: var(--color-page);
      color: var(--color-text);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      text-rendering: geometricPrecision;
      -webkit-font-smoothing: antialiased;
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
      grid-template-columns: minmax(190px, 1fr) minmax(0, auto) minmax(48px, 1fr);
      align-items: center;
      gap: clamp(16px, 3vw, 32px);
      width: 100%;
      height: 76px;
      min-height: 76px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
      padding: 12px clamp(20px, 4vw, 48px);
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
      gap: 10px;
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
    }

    .liax-public-header__center,
    .liax-public-menu {
      flex-wrap: nowrap;
      justify-content: center;
      min-width: 0;
    }

    .liax-public-header__center {
      display: grid;
      grid-template-columns: 44px minmax(0, auto);
      align-items: center;
      gap: 14px;
    }

    .liax-public-menu {
      flex: 1 1 auto;
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
      flex: 0 0 clamp(56px, 7vw, 84px);
      display: inline-flex;
      justify-content: center;
      width: clamp(56px, 7vw, 84px);
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

    .liax-public-search {
      box-sizing: border-box;
      width: min(220px, 22vw);
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
      max-width: 980px;
      margin: 0 auto;
      padding: 32px 24px 56px;
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
      min-height: 40px;
      border: 1px solid var(--color-primary);
      border-radius: 999px;
      background: var(--color-primary);
      color: var(--color-primary-text);
      font: inherit;
      font-weight: 760;
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

    .liax-search-empty {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface-muted);
      padding: 16px;
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
        grid-template-columns: auto minmax(0, auto) auto;
        height: 76px;
        min-height: 76px;
        gap: 14px;
        overflow-x: auto;
        padding: 10px 16px;
      }

      .liax-public-header__center,
      .liax-public-header__tools {
        align-items: center;
        flex: 0 0 auto;
        flex-direction: row;
      }

      .liax-public-header__center {
        grid-template-columns: 44px minmax(0, auto);
      }

      .liax-public-menu {
        flex-wrap: nowrap;
      }

      .liax-public-search {
        width: 118px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .liax-public-header,
      .liax-search-card {
        animation: none;
      }
    }
  </style>
</head>
<body>
  <div class="liax-public-shell">
    <header class="liax-public-header">
      <a class="liax-public-brand" href="/${localePrefix}">
        <span class="liax-public-logo" aria-hidden="true">LS</span>
        <span>Liax Space</span>
      </a>
      <div class="liax-public-header__center">
        ${renderSearchLanguageSwitch(localePrefix, query)}
        <nav class="liax-public-menu" aria-label="Primary">
          <a href="/${localePrefix}">${isZh ? "首页" : "Home"}</a>
          <a href="/${localePrefix}/posts">${isZh ? "文章" : "Articles"}</a>
          <a href="/${localePrefix}/tags">${isZh ? "标签" : "Tags"}</a>
          <a href="/${localePrefix}/moments">${isZh ? "瞬间" : "Moments"}</a>
          <a href="/${localePrefix}/guestbook">${isZh ? "留言" : "Guestbook"}</a>
          <a href="/${localePrefix}/archives">${isZh ? "归档" : "Archives"}</a>
        </nav>
      </div>
      <div class="liax-public-header__tools">
        <a class="liax-public-avatar" href="/${localePrefix}/account" aria-label="User">A</a>
      </div>
    </header>
    <main class="liax-search-page">
      <section class="liax-search-card">
        <a class="liax-search-back" href="/${localePrefix}">Liax Space</a>
        <h1>${title}</h1>
        <form class="liax-search-form" action="/${localePrefix}/search" method="get" role="search">
          <input aria-label="${title}" name="q" type="search" value="${escapeHtml(query)}">
        </form>
        <h2>${resultLabel}</h2>
        ${results.length === 0 ? `<p class="liax-search-empty">${empty}</p>` : `<div class="liax-search-results">
${results.map((result) => `        <article class="liax-search-result">
          <a href="${escapeHtml(result.url ?? `/${localePrefix}`)}">${escapeHtml(result.title)}</a>
          ${result.summary ? `<p>${escapeHtml(result.summary)}</p>` : ""}
        </article>`).join("\n")}
        </div>`}
      </section>
    </main>
  </div>
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
      response.status(200).type("html").send(renderPublicSearchPage(
        request.params.localePrefix,
        typeof queryValue === "string" ? queryValue : "",
        results
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
