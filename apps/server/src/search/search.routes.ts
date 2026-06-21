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

function hasQuestionMarkMojibake(value: string): boolean {
  const trimmed = value.trim();

  if (!/\?{3,}/u.test(trimmed)) {
    return false;
  }

  const questionCount = [...trimmed].filter((character) => character === "?").length;
  const strongCharacters = trimmed.replace(/\?{3,}/gu, "").replace(/[\s.,，。:：;；!?！？'"“”‘’()[\]{}<>/\\|_-]/gu, "");

  return strongCharacters.length === 0 || questionCount / Math.max(trimmed.length, 1) >= 0.45;
}

function dataRepairLabel(localePrefix: "zh" | "en"): string {
  return localePrefix === "zh" ? "内容数据待修复" : "Content data needs repair";
}

function safeSearchTitle(localePrefix: "zh" | "en", title: string): { label: string; repaired: boolean } {
  if (!hasQuestionMarkMojibake(title)) {
    return { label: title, repaired: false };
  }

  return {
    label: localePrefix === "zh" ? "这条结果的标题待修复" : "This result title needs repair",
    repaired: true
  };
}

function safeSearchSummary(summary: string | null): string {
  if (!summary || hasQuestionMarkMojibake(summary)) {
    return "";
  }

  return summary;
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

function renderLogoPreviewTags(settings: SiteSettings): string {
  const logoUrl = readLogoUrl(settings);

  if (!logoUrl) {
    return "";
  }

  const logoAlt = readStringSetting(settings, "site.logoAlt", "Liax Space");
  const escapedLogoAlt = escapeHtml(logoAlt);
  const escapedLogoUrl = escapeHtml(logoUrl);

  return `<link rel="apple-touch-icon" href="${escapedLogoUrl}">
  <meta property="og:image" content="${escapedLogoUrl}">
  <meta property="og:image:alt" content="${escapedLogoAlt}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:image" content="${escapedLogoUrl}">`;
}

function renderPublicLogo(settings: SiteSettings): string {
  const logoUrl = readLogoUrl(settings);
  const logoAlt = readStringSetting(settings, "site.logoAlt", "Liax Space");

  if (!logoUrl) {
    return `<span class="liax-public-logo" aria-hidden="true"><span>LS</span></span>`;
  }

  return `<span class="liax-public-logo"><img alt="${escapeHtml(logoAlt)}" onerror="this.remove()" src="${escapeHtml(logoUrl)}"></span>`;
}

function renderPublicAvatar(avatarUrl: string | null): string {
  if (!avatarUrl || !isPublicAssetUrl(avatarUrl)) {
    return `<a class="liax-public-avatar" href="/console" aria-label="Console"><span aria-hidden="true">A</span></a>`;
  }

  return `<a class="liax-public-avatar" href="/console" aria-label="Console"><span aria-hidden="true">A</span><img alt="" onerror="this.remove()" src="${escapeHtml(avatarUrl)}"></a>`;
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

function formatSearchResultMeta(localePrefix: "zh" | "en", result: SearchResult): string {
  if (result.kind === "home") {
    return localePrefix === "zh" ? "首页" : "Home";
  }

  if (result.kind === "tag") {
    return localePrefix === "zh" ? "标签" : "Tag";
  }

  if (result.kind === "moment") {
    return localePrefix === "zh" ? "瞬间" : "Moment";
  }

  return formatVisitCount(localePrefix, result.visitCount);
}

function renderSearchEmptyState(localePrefix: "zh" | "en", isZh: boolean): string {
  const scopeTitle = isZh ? "搜索范围" : "Search scope";
  const scopeText = isZh
    ? "当前搜索覆盖已发布文章、标签、瞬间和首页内容。"
    : "Search covers published articles, tags, moments, and home page content.";
  const actionText = isZh ? "可以换一个关键词，或继续浏览这些入口。" : "Try another keyword, or continue browsing from these entry points.";
  const links = [
    { href: `/${localePrefix}/posts`, label: isZh ? "文章列表" : "Articles" },
    { href: `/${localePrefix}/tags`, label: isZh ? "全部标签" : "All tags" },
    { href: `/${localePrefix}/moments`, label: isZh ? "瞬间" : "Moments" }
  ];

  return `<div class="liax-search-empty">
          <strong>${escapeHtml(scopeTitle)}</strong>
          <p>${escapeHtml(scopeText)}</p>
          <p>${escapeHtml(actionText)}</p>
          <nav class="liax-search-empty__links" aria-label="${escapeHtml(isZh ? "继续浏览" : "Continue browsing")}">
${links.map((link) => `            <a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join("\n")}
          </nav>
        </div>`;
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
  const title = isZh ? "浏览 Liax Space" : "Browse Liax Space";
  const description = isZh ? "选择一个内容入口，或直接搜索公开内容。" : "Choose a section, or search public content directly.";
  const footer = "Liax Space";

  return `<div class="liax-public-sidebar-layer" aria-hidden="true" inert data-public-sidebar-layer>
      <button class="liax-public-sidebar-backdrop" type="button" aria-label="${closeLabel}" data-public-sidebar-close></button>
      <aside class="liax-public-sidebar" aria-label="${closeLabel}">
        <header class="liax-public-sidebar__header">
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(description)}</span>
        </header>
        ${renderPublicSearchForm(localePrefix, isZh, "sidebar", query)}
        <nav class="liax-public-sidebar-menu" aria-label="Primary">
          ${renderPublicMenuLinks(localePrefix, isZh)}
        </nav>
        <p class="liax-public-sidebar__footer">${escapeHtml(footer)}</p>
      </aside>
    </div>`;
}

function renderPublicPolishCss(): string {
  return `    .liax-public-header {
      position: relative;
      z-index: 60;
      background: rgb(250 249 245 / 88%);
      backdrop-filter: blur(14px);
    }

    .liax-public-logo {
      border: 0 !important;
      border-radius: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
      color: var(--color-text) !important;
      overflow: visible !important;
    }

    .liax-public-logo img {
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      object-fit: contain !important;
      background: transparent !important;
    }

    .liax-public-avatar {
      width: 40px;
      height: 40px;
      overflow: hidden;
      border-radius: 999px;
    }

    .liax-public-avatar img {
      border-radius: inherit;
      object-fit: cover;
    }

    .liax-public-menu {
      grid-template-columns: repeat(6, max-content);
      gap: 2px;
    }

    .liax-public-menu a {
      width: auto;
      min-width: 0;
      min-height: 30px;
      align-items: center;
      border-radius: 999px;
      font-size: 13px;
      padding: 4px 10px;
      transition: background-color 180ms ease, box-shadow 180ms ease, color 180ms ease, transform 180ms ease;
    }

    .liax-public-menu a[aria-current="page"],
    .liax-public-sidebar-menu a[aria-current="page"] {
      background: rgb(238 245 233 / 74%);
      color: #3f6b4a;
      box-shadow: inset 0 0 0 1px rgb(95 122 80 / 22%);
      text-decoration: none;
    }

    .liax-public-menu a:hover,
    .liax-public-menu a:focus-visible {
      background: rgb(238 245 233 / 62%);
      box-shadow: inset 0 0 0 1px rgb(95 122 80 / 18%);
      text-decoration: none;
      transform: translateY(-1px);
    }

    .liax-public-search,
    .liax-search-form input {
      min-height: 38px;
      transition: background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
    }

    .liax-public-search:focus,
    .liax-search-form input:focus {
      border-color: #5f7a50;
      background: #fffdfa;
      box-shadow: 0 0 0 4px rgb(95 122 80 / 14%);
      outline: 0;
    }

    .liax-public-avatar {
      background: #ffffff;
      box-shadow: 0 2px 10px rgb(20 20 19 / 5%);
      transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
    }

    .liax-public-avatar > span {
      opacity: 1;
    }

    .liax-public-avatar:hover,
    .liax-public-avatar:focus-visible {
      border-color: rgb(95 122 80 / 42%);
      box-shadow: 0 8px 22px rgb(20 20 19 / 8%);
      outline: 0;
      transform: translateY(-1px);
    }

    .liax-public-sidebar-backdrop {
      background: rgb(20 20 19 / 12%);
      backdrop-filter: blur(3px);
    }

    .liax-public-sidebar {
      border-radius: 8px 0 0 8px;
      background:
        linear-gradient(180deg, rgb(255 255 255 / 94%), rgb(250 249 245 / 94%)),
        var(--color-page);
    }

    .liax-public-sidebar__header,
    .liax-public-sidebar__footer {
      display: grid;
      gap: 6px;
      border: 1px solid rgb(199 194 185 / 70%);
      border-radius: 8px;
      background: rgb(255 255 255 / 74%);
      padding: 14px;
    }

    .liax-public-sidebar__header strong {
      font-size: 18px;
      line-height: 1.2;
    }

    .liax-public-sidebar__header span,
    .liax-public-sidebar__footer {
      margin: 0;
      color: #6f6a5d;
      font-size: 13px;
      line-height: 1.45;
    }

    .liax-public-sidebar-menu a {
      min-height: 44px;
      border-radius: 8px;
      transition: background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
    }

    .liax-public-sidebar-menu a:hover,
    .liax-public-sidebar-menu a:focus-visible {
      background: rgb(238 245 233 / 62%);
      box-shadow: 0 8px 20px rgb(20 20 19 / 6%);
      text-decoration: none;
      transform: translateX(-2px);
    }

    .liax-data-quality-note {
      display: inline-flex;
      width: max-content;
      max-width: 100%;
      align-items: center;
      border: 1px solid rgb(208 161 63 / 36%);
      border-radius: 999px;
      background: #fff4d8;
      color: #704600;
      font-size: 12px;
      font-weight: 780;
      line-height: 1;
      padding: 5px 8px;
    }

    @media (max-width: 860px) {
      .liax-public-sidebar {
        width: min(340px, calc(100vw - 56px));
        padding: 18px;
      }
    }

`;
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
  ${renderLogoPreviewTags(settings)}
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

    .liax-public-logo > span,
    .liax-public-logo > img,
    .liax-public-avatar > span,
    .liax-public-avatar > img {
      grid-area: 1 / 1;
    }

    .liax-public-logo > img,
    .liax-public-avatar > img {
      background: var(--color-surface-muted);
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
      flex-direction: column;
      justify-content: center;
      gap: 4px;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface-muted);
      color: var(--color-text);
      cursor: pointer;
      padding: 0;
    }

    .liax-public-menu-toggle span {
      display: block;
      width: 16px;
      height: 2px;
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
      width: min(340px, calc(100vw - 56px));
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
      width: min(1560px, calc(100% - clamp(24px, 5vw, 80px)));
      max-width: none;
      margin: 0 auto;
      padding: 20px 0 42px;
    }

    .liax-search-card,
    .liax-search-result {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      color: var(--color-text);
    }

    .liax-search-card {
      background:
        linear-gradient(135deg, rgb(255 255 255 / 90%), rgb(245 244 237 / 58%));
      box-shadow: 0 16px 44px rgb(20 20 19 / 5%);
      padding: clamp(24px, 4vw, 42px);
    }

    .liax-search-card h1 {
      margin: 0 0 18px;
      font-size: clamp(32px, 4.6vw, 54px);
      line-height: 1.05;
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
      background: rgb(255 255 255 / 82%);
      box-shadow: 0 8px 22px rgb(20 20 19 / 4%);
      padding: 16px 18px;
      transition:
        border-color 180ms ease,
        box-shadow 180ms ease,
        transform 180ms ease;
    }

    .liax-search-result:hover,
    .liax-search-result:focus-within {
      border-color: var(--color-accent);
      box-shadow: 0 14px 34px rgb(20 20 19 / 7%);
      transform: translateY(-1px);
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
      display: grid;
      gap: 10px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background:
        radial-gradient(circle at 22px 22px, rgb(217 119 87 / 10%) 0 12px, transparent 13px),
        linear-gradient(135deg, rgb(255 255 255 / 92%), rgb(245 244 237 / 76%));
      padding: 18px 18px 18px 52px;
    }

    .liax-search-empty strong {
      color: var(--color-text);
      font-size: 15px;
      font-weight: 820;
    }

    .liax-search-empty p {
      margin: 0;
    }

    .liax-search-empty__links {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 2px;
    }

    .liax-search-empty__links a {
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-accent);
      font-weight: 760;
      padding: 7px 11px;
      text-decoration: none;
    }

    .liax-search-empty__links a:hover,
    .liax-search-empty__links a:focus-visible {
      border-color: var(--color-accent);
      outline: 0;
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
        overflow: visible;
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
      .liax-public-sidebar-layer,
      .liax-public-sidebar {
        transition: none;
      }
    }
${renderPublicPolishCss()}
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
        ${results.length === 0 ? renderSearchEmptyState(localePrefix, isZh) : `<div class="liax-search-results">
${results.map((result) => {
  const title = safeSearchTitle(localePrefix, result.title);
  const summary = safeSearchSummary(result.summary);

  return `        <article class="liax-search-result">
          <a href="${escapeHtml(result.url ?? `/${localePrefix}`)}">${escapeHtml(title.label)}</a>
          <small>${escapeHtml(formatSearchResultMeta(localePrefix, result))}</small>
          ${title.repaired ? `<span class="liax-data-quality-note">${escapeHtml(dataRepairLabel(localePrefix))}</span>` : ""}
          ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
        </article>`;
}).join("\n")}
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
