import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import type { Request, Response } from "express";

import { ArticleTranslationRepository } from "../articles/ArticleTranslationRepository.js";
import { canRoleViewArticleAudience, formatArticleAudienceLabel } from "../articles/articleAudience.js";
import type { ArticleLocale, ArticleTranslation } from "../articles/articles.types.js";
import { JwtService, type AuthTokenPayload } from "../auth/JwtService.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { logger } from "../common/logger.js";
import { storagePaths } from "../config/paths.js";
import { GuestbookRepository } from "../guestbook/GuestbookRepository.js";
import type { CreateGuestbookEntryInput, GuestbookEntry } from "../guestbook/guestbook.types.js";
import { MailService } from "../mail/MailService.js";
import { MomentRepository } from "../moments/MomentRepository.js";
import type { Moment } from "../moments/moments.types.js";
import { renderLanguageSwitchScript } from "../renderer/TemplateRenderer.js";
import { SearchService, type SearchResult } from "../search/SearchService.js";
import { SettingsRepository } from "../settings/SettingsRepository.js";
import type { SiteSettings } from "../settings/settings.types.js";
import { TagRepository, type TagDetail } from "../tags/TagRepository.js";
import { UserRepository } from "../users/UserRepository.js";

type LocalePrefix = "zh" | "en";

type RenderMomentsOptions = {
  shouldRenderImage?: (image: string) => boolean;
};

const localePrefixMap: Record<LocalePrefix, ArticleLocale> = {
  en: "en-US",
  zh: "zh-CN"
};

function notFoundError(): AppError {
  return new AppError("Published article not found.", {
    code: errorCodes.notFound,
    statusCode: 404
  });
}

function prefixToLocale(prefix: string): ArticleLocale | null {
  if (prefix !== "zh" && prefix !== "en") {
    return null;
  }

  return localePrefixMap[prefix];
}

function isPublishedTranslation(
  translation: ArticleTranslation
): translation is ArticleTranslation & { currentHtmlPath: string; publishedAt: Date; publishedVersionId: number } {
  return translation.publishedVersionId !== null && translation.currentHtmlPath !== null && translation.publishedAt !== null;
}

function resolveRenderedHtmlPath(currentHtmlPath: string): string | null {
  const renderedRoot = resolve(storagePaths.renderedDir);
  const absolutePath = resolve(renderedRoot, currentHtmlPath);
  const relativePath = relative(renderedRoot, absolutePath);

  if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
    return null;
  }

  return absolutePath;
}

function isFileNotFound(error: unknown): boolean {
  return error !== null && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "ENOENT";
}

function readBearerToken(authorizationHeader: unknown): string | null {
  if (typeof authorizationHeader !== "string") {
    return null;
  }

  const parts = authorizationHeader.split(" ");

  if (parts.length !== 2) {
    return null;
  }

  const [scheme, token] = parts;
  return scheme === "Bearer" && token ? token : null;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function publicUploadUrlToPath(value: string): string | null {
  const pathname = value.split(/[?#]/u)[0] ?? "";

  if (!pathname.startsWith("/uploads/")) {
    return null;
  }

  let decodedPath: string;

  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relativePath = decodedPath.slice("/uploads/".length);

  if (!relativePath || relativePath.includes("\0")) {
    return null;
  }

  const uploadRoot = resolve(storagePaths.uploadsDir);
  const absolutePath = resolve(uploadRoot, ...relativePath.split("/"));

  return absolutePath.startsWith(`${uploadRoot}${sep}`) ? absolutePath : null;
}

function isExistingPublicUploadImage(value: string): boolean {
  const uploadPath = publicUploadUrlToPath(value);

  if (!uploadPath) {
    return true;
  }

  try {
    return statSync(uploadPath).isFile();
  } catch {
    return false;
  }
}

function readBodyString(body: unknown, key: string): string {
  if (!body || typeof body !== "object") {
    return "";
  }

  const value = (body as Record<string, unknown>)[key];

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return "";
}

function readBodyBoolean(body: unknown, key: string): boolean {
  const value = readBodyString(body, key).trim().toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "yes";
}

function renderHomeLanguageSwitch(prefix: LocalePrefix): string {
  const targetPrefix = prefix === "zh" ? "en" : "zh";
  const targetLocale = targetPrefix === "zh" ? "zh-CN" : "en-US";
  const label = targetLocale === "zh-CN" ? "切换到中文" : "Switch to English";
  const visibleLabel = targetLocale === "zh-CN" ? "中" : "EN";

  return `<nav class="liax-language-switch" aria-label="Language switch" data-language-switch-placeholder="true">
        <a class="liax-button liax-language-icon-button" aria-label="${label}" data-locale-target="${targetLocale}" href="/${targetPrefix}">
          <span aria-hidden="true">${visibleLabel}</span>
        </a>
      </nav>`;
}

function renderPublicMenuLinks(prefix: LocalePrefix, isZh: boolean): string {
  return `<a href="/${prefix}">${isZh ? "首页" : "Home"}</a>
          <a href="/${prefix}/posts">${isZh ? "文章" : "Articles"}</a>
          <a href="/${prefix}/tags">${isZh ? "标签" : "Tags"}</a>
          <a href="/${prefix}/moments">${isZh ? "瞬间" : "Moments"}</a>
          <a href="/${prefix}/guestbook">${isZh ? "留言" : "Guestbook"}</a>
          <a href="/${prefix}/archives">${isZh ? "归档" : "Archives"}</a>`;
}

function renderPublicSearchForm(prefix: LocalePrefix, isZh: boolean, variant: "inline" | "sidebar"): string {
  const label = isZh ? "搜索" : "Search";

  return `<form class="liax-public-search-form liax-public-search-form--${variant}" action="/${prefix}/search" method="get" role="search">
          <input class="liax-public-search" aria-label="${label}" data-public-search-overlay-trigger name="q" type="search" placeholder="${label}">
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

function renderPublicSidebar(prefix: LocalePrefix, isZh: boolean): string {
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
        ${renderPublicSearchForm(prefix, isZh, "sidebar")}
        <nav class="liax-public-sidebar-menu" aria-label="Primary">
          ${renderPublicMenuLinks(prefix, isZh)}
        </nav>
        <p class="liax-public-sidebar__footer">${escapeHtml(footer)}</p>
      </aside>
    </div>`;
}

function readStringSetting(settings: SiteSettings, key: string, fallback: string): string {
  const value = settings[key];

  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readUrlSetting(settings: SiteSettings, key: string, fallback: string): string {
  const value = readStringSetting(settings, key, fallback);

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
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

type PublicThemePresetId = "clear-graphite" | "quiet-garden" | "warm-minimal";

const publicThemePresets: Record<PublicThemePresetId, Record<string, string>> = {
  "clear-graphite": {
    "--color-accent": "#6a625a",
    "--color-border": "#c7c2b9",
    "--color-brand": "#5a554f",
    "--color-primary": "#111315",
    "--color-surface-muted": "#efeee8"
  },
  "quiet-garden": {
    "--color-accent": "#5f7a50",
    "--color-border": "#c6d0bf",
    "--color-brand": "#3f6b4a",
    "--color-primary": "#102316",
    "--color-surface-muted": "#edf2e7"
  },
  "warm-minimal": {}
};

const editablePublicThemeTokens = [
  "--color-accent",
  "--color-border",
  "--color-brand",
  "--color-primary",
  "--color-surface-muted"
] as const;

function isPublicThemePresetId(value: unknown): value is PublicThemePresetId {
  return value === "warm-minimal" || value === "quiet-garden" || value === "clear-graphite";
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value);
}

function renderThemeCssVariables(settings: SiteSettings): string {
  const presetId = isPublicThemePresetId(settings["theme.preset"]) ? settings["theme.preset"] : "warm-minimal";
  const values = { ...publicThemePresets[presetId] };
  const customColors = settings["theme.customColors"];

  if (customColors && typeof customColors === "object" && !Array.isArray(customColors)) {
    const presetColors = (customColors as Record<string, unknown>)[presetId];

    if (presetColors && typeof presetColors === "object" && !Array.isArray(presetColors)) {
      for (const tokenName of editablePublicThemeTokens) {
        const color = (presetColors as Record<string, unknown>)[tokenName];

        if (isHexColor(color)) {
          values[tokenName] = color.toLowerCase();
        }
      }
    }
  }

  return Object.entries(values)
    .map(([tokenName, color]) => `      ${tokenName}: ${color};`)
    .join("\n");
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

    .liax-public-search {
      min-height: 38px;
      transition: background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
    }

    .liax-public-search:focus {
      border-color: #5f7a50;
      background: #fffdfa;
      box-shadow: 0 0 0 4px rgb(95 122 80 / 14%);
      outline: 0;
    }

    .liax-public-avatar {
      background: var(--color-surface);
      box-shadow: 0 2px 10px rgb(20 20 19 / 5%);
      transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
    }

    .liax-public-avatar > span {
      opacity: 1;
    }

    .liax-article-tags {
      position: fixed !important;
      inset-block-start: 96px !important;
      inset-inline-end: clamp(18px, 3vw, 40px) !important;
      z-index: 22 !important;
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 7px !important;
      box-sizing: border-box !important;
      width: clamp(220px, 20vw, 300px) !important;
      max-height: 92px !important;
      margin: 0 !important;
      overflow-y: auto !important;
      border: 1px solid rgb(199 194 185 / 76%) !important;
      border-radius: 8px !important;
      background: rgb(250 249 245 / 92%) !important;
      box-shadow: 0 14px 36px rgb(20 20 19 / 9%) !important;
      padding: 11px 12px !important;
      backdrop-filter: blur(10px);
    }

    .liax-article-tags a {
      background: var(--color-surface) !important;
      font-size: 12px !important;
      padding: 6px 9px !important;
    }

    .liax-article-toc {
      inset-block-start: 204px !important;
      max-height: calc(100vh - 228px) !important;
    }

    @media (max-width: 1080px) {
      .liax-article-tags {
        position: static !important;
        inset: auto !important;
        width: auto !important;
        max-height: none !important;
        margin-top: 14px !important;
        overflow: visible !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
      }

      .liax-article-toc {
        inset-block-start: 84px !important;
        max-height: 42vh !important;
      }
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

    .liax-section-empty {
      min-height: 92px;
      border-style: dashed;
      box-shadow: inset 0 1px 0 rgb(255 255 255 / 62%);
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

    .liax-archive-group .liax-data-quality-note {
      align-self: center;
      justify-self: start;
    }

    .liax-guestbook-form__notify input {
      appearance: none;
      display: inline-grid;
      width: 22px;
      height: 22px;
      place-items: center;
      border: 1px solid rgb(95 122 80 / 50%);
      border-radius: 6px;
      background: #ffffff;
      margin: 0;
      transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
    }

    .liax-guestbook-form__notify input:checked {
      border-color: #5f7a50;
      background: #5f7a50;
      box-shadow: inset 0 0 0 5px #ffffff;
    }

    .liax-guestbook-form__notify input:focus-visible {
      box-shadow: 0 0 0 4px rgb(95 122 80 / 16%);
      outline: 0;
    }

    @media (max-width: 860px) {
      .liax-public-header {
        position: relative;
      }

      .liax-public-sidebar {
        width: min(340px, calc(100vw - 56px));
        padding: 18px;
      }
    }

`;
}

function readCodeInjection(settings: SiteSettings, key: "codeInjection.contentHead" | "codeInjection.footer" | "codeInjection.globalHead"): string {
  const value = settings[key];

  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function renderHeadInjection(settings: SiteSettings, includeContentHead: boolean): string {
  const parts = [
    readCodeInjection(settings, "codeInjection.globalHead"),
    includeContentHead ? readCodeInjection(settings, "codeInjection.contentHead") : ""
  ].filter(Boolean);

  return parts.length > 0 ? `${parts.join("\n")}\n` : "";
}

function renderFooterInjection(settings: SiteSettings): string {
  const footerInjection = readCodeInjection(settings, "codeInjection.footer");

  return footerInjection ? `\n${footerInjection}` : "";
}

type PublishedArticleChrome = {
  allowedRoles: string[];
  locale: ArticleLocale;
  prefix: LocalePrefix;
  publishedAt: Date | null;
  visitCount: number;
  tags: PublishedArticleTag[];
  newerArticle: SearchResult | null;
  olderArticle: SearchResult | null;
};

type PublishedArticleTag = {
  name: string;
  slug: string;
};

function formatArticleDate(locale: ArticleLocale, date: Date | null): string {
  if (!date || !Number.isFinite(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

type PublishedArticleChromeParts = {
  footerHtml: string;
  headerHtml: string;
};

function renderPublishedArticleChrome(meta: PublishedArticleChrome | null): PublishedArticleChromeParts {
  if (!meta) {
    return { footerHtml: "", headerHtml: "" };
  }

  const isZh = meta.locale === "zh-CN";
  const dateLabel = formatArticleDate(meta.locale, meta.publishedAt);
  const readLabel = meta.visitCount > 0
    ? (isZh ? `${meta.visitCount} \u9605\u8bfb` : `${meta.visitCount} ${meta.visitCount === 1 ? "read" : "reads"}`)
    : "";
  const metaItems = [
    dateLabel ? `<time datetime="${escapeHtml(dateLabel)}">${escapeHtml(dateLabel)}</time>` : "",
    readLabel ? `<span>${escapeHtml(readLabel)}</span>` : ""
  ].filter(Boolean);
  const navItems = [
    meta.olderArticle?.url
      ? `<a href="${escapeHtml(meta.olderArticle.url)}"><span>${escapeHtml(isZh ? "\u4e0a\u4e00\u7bc7" : "Previous")}</span><strong>${escapeHtml(meta.olderArticle.title)}</strong></a>`
      : "",
    meta.newerArticle?.url
      ? `<a href="${escapeHtml(meta.newerArticle.url)}"><span>${escapeHtml(isZh ? "\u4e0b\u4e00\u7bc7" : "Next")}</span><strong>${escapeHtml(meta.newerArticle.title)}</strong></a>`
      : ""
  ].filter(Boolean);
  const tagLinks = meta.tags.map((tag) => {
    return `<a href="/${meta.prefix}/tags/${encodeURIComponent(tag.slug)}"><span aria-hidden="true">#</span>${escapeHtml(tag.name)}</a>`;
  });
  const audienceHtml = renderArticleAudienceHtml(meta.locale, meta.allowedRoles);
  const headerHtml = `<div class="liax-article-utility">
          <a href="/${meta.prefix}/posts">${escapeHtml(isZh ? "\u8fd4\u56de\u6587\u7ae0\u5217\u8868" : "Back to articles")}</a>
          ${metaItems.length > 0 ? `<p>${metaItems.join("<span aria-hidden=\"true\">/</span>")}</p>` : ""}
        </div>
        ${audienceHtml}
        ${tagLinks.length > 0 ? `<nav class="liax-article-tags" aria-label="${escapeHtml(isZh ? "\u6587\u7ae0\u6807\u7b7e" : "Article tags")}">${tagLinks.join("")}</nav>` : ""}`;
  const footerHtml = navItems.length > 0
    ? `<footer class="liax-article-footer">
        <nav class="liax-article-neighbor-nav" aria-label="${escapeHtml(isZh ? "\u76f8\u90bb\u6587\u7ae0" : "Neighbor articles")}">${navItems.join("")}</nav>
      </footer>`
    : "";

  return { footerHtml, headerHtml };
}

function hasRenderedArticleUtility(html: string): boolean {
  return /<[^>]+\bclass=(["'])[^"']*\bliax-article-utility\b[^"']*\1/iu.test(html);
}

function hasRenderedArticleAudience(html: string): boolean {
  return /<[^>]+\bclass=(["'])[^"']*\bliax-article-audience\b[^"']*\1/iu.test(html);
}

function hasRenderedArticleNeighborNav(html: string): boolean {
  return /<[^>]+\bclass=(["'])[^"']*\bliax-article-neighbor-nav\b[^"']*\1/iu.test(html);
}

function renderArticleAudienceHtml(locale: ArticleLocale, allowedRoles: readonly string[]): string {
  const label = locale === "zh-CN" ? "\u53ef\u89c1\u8303\u56f4" : "Audience";
  const value = formatArticleAudienceLabel(allowedRoles, locale);

  return `<p class="liax-article-audience"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></p>`;
}

function moveArticleNeighborNavAfterBody(html: string): string {
  const navRegex = /<nav\b(?=[^>]*\bliax-article-neighbor-nav\b)[^>]*>[\s\S]*?<\/nav>/iu;
  const navMatch = navRegex.exec(html);

  if (!navMatch) {
    return html;
  }

  const articleCloseIndex = html.indexOf("</article>");

  if (articleCloseIndex < 0 || navMatch.index > articleCloseIndex) {
    return html;
  }

  const navHtml = navMatch[0];
  const withoutNav = `${html.slice(0, navMatch.index)}${html.slice(navMatch.index + navHtml.length)}`;

  return withoutNav.replace("</article>", `</article>
      <footer class="liax-article-footer">
        ${navHtml}
      </footer>`);
}

function removeDuplicateHeaderLanguageSwitches(html: string): string {
  return html.replace(/(<header class="liax-public-header"[^>]*>)([\s\S]*?)(<\/header>)/u, (_match, openTag: string, headerBody: string, closeTag: string) => {
    let hasLanguageSwitch = false;
    const nextHeaderBody = headerBody.replace(
      /<nav\b(?=[^>]*\bliax-language-switch\b)(?=[^>]*data-language-switch-placeholder="true")[^>]*>[\s\S]*?<\/nav>/gu,
      (navHtml) => {
        if (hasLanguageSwitch) {
          return "";
        }

        hasLanguageSwitch = true;
        return navHtml;
      }
    );

    return `${openTag}${nextHeaderBody}${closeTag}`;
  });
}

function markPublishedArticleMenuActive(html: string, prefix: LocalePrefix): string {
  const postsHref = escapeRegExp(`/${prefix}/posts`);
  const postsLinkRegex = new RegExp(`(<a\\b(?=[^>]*\\bhref=["']${postsHref}["'])[^>]*)>`, "u");

  return html.replace(
    /<nav\b(?=[^>]*\bclass=(["'])[^"']*\bliax-public-(?:sidebar-)?menu\b[^"']*\1)[^>]*>[\s\S]*?<\/nav>/gu,
    (navHtml) => navHtml
      .replace(/\saria-current=(["'])page\1/gu, "")
      .replace(postsLinkRegex, '$1 aria-current="page">')
  );
}

function sanitizePublishedArticleMojibake(html: string, locale: ArticleLocale | null): string {
  const fallback = locale === "zh-CN" ? "内容数据待修复" : "Content data needs repair";

  return html
    .replace(/>(\s*)\?{3,}([\s.,，。:：;；!?！？'"“”‘’()[\]{}<>/\\|_-]*)(\s*)</gu, (_match, before: string, _punctuation: string, after: string) => {
      return `>${before}${fallback}${after}<`;
    })
    .replace(/(content="[^"]*)\?{3,}([\s.,，。:：;；!?！？'"“”‘’()[\]{}<>/\\|_-]*)([^"]*")/gu, `$1${fallback}$3`)
    .replace(/(title>[\s\S]*?)\?{3,}([\s.,，。:：;；!?！？'"“”‘’()[\]{}<>/\\|_-]*)([\s\S]*?<\/title>)/u, `$1${fallback}$3`);
}

export function patchPublishedArticleHtml(
  html: string,
  settings: SiteSettings,
  avatarUrl: string | null,
  articleChrome: PublishedArticleChrome | null = null
): string {
  const logoHtml = renderPublicLogo(settings);
  const avatarHtml = renderPublicAvatar(avatarUrl);
  const faviconHtml = renderFaviconLink(settings);
  const logoPreviewHtml = renderLogoPreviewTags(settings);
  const headInjection = renderHeadInjection(settings, true);
  const footerInjection = renderFooterInjection(settings);
  const articleChromeParts = renderPublishedArticleChrome(articleChrome);
  let patched = html
    .replace(/<link rel="icon" href="[^"]*">/u, faviconHtml)
    .replace(/<span class="liax-public-logo"(?: aria-hidden="true")?>[\s\S]*?<\/span>/u, logoHtml)
    .replace(/<a class="liax-public-avatar" href="\/console" aria-label="Console">[\s\S]*?<\/a>/u, avatarHtml)
    .replace(/window\.scrollTo\(\{ top: 0 \}\);/gu, "window.scrollTo({ left: window.scrollX, top: window.scrollY });");

  patched = removeDuplicateHeaderLanguageSwitches(patched);
  patched = sanitizePublishedArticleMojibake(patched, articleChrome?.locale ?? null);
  if (articleChrome) {
    patched = markPublishedArticleMenuActive(patched, articleChrome.prefix);
  }

  if (logoPreviewHtml && !/<meta\s+(?:property|name)=["'](?:og:image|twitter:image)["']/iu.test(patched)) {
    patched = patched.replace(/<\/head>/iu, `${logoPreviewHtml}
</head>`);
  }

  if (articleChromeParts.headerHtml && !hasRenderedArticleUtility(patched)) {
    const nextPatched = patched.replace(
      /(<header class="liax-article-header">[\s\S]*?<h1>[\s\S]*?<\/h1>)([\s\S]*?<\/header>)/u,
      `$1
        ${articleChromeParts.headerHtml}
      </header>`
    );

    patched = nextPatched === patched
      ? patched.replace(
        /(<article class="liax-article-body">\s*)(<h1>[\s\S]*?<\/h1>)/u,
        `$1<header class="liax-article-header">
        $2
        ${articleChromeParts.headerHtml}
      </header>`
      )
      : nextPatched;
  }

  if (articleChrome && !hasRenderedArticleAudience(patched)) {
    const audienceHtml = renderArticleAudienceHtml(articleChrome.locale, articleChrome.allowedRoles);
    const nextPatched = patched.replace(
      /(<div class="liax-article-utility">[\s\S]*?<\/div>)/u,
      `$1
        ${audienceHtml}`
    );

    patched = nextPatched === patched
      ? patched.replace(
        /(<header class="liax-article-header">[\s\S]*?<h1>[\s\S]*?<\/h1>)/u,
        `$1
        ${audienceHtml}`
      )
      : nextPatched;
  }

  if (articleChromeParts.footerHtml && !hasRenderedArticleNeighborNav(patched)) {
    patched = patched.replace("</article>", `</article>
      ${articleChromeParts.footerHtml}`);
  }

  patched = moveArticleNeighborNavAfterBody(patched);

  if (headInjection) {
    patched = patched.replace("</head>", `${headInjection}</head>`);
  }

  if (footerInjection) {
    patched = patched.replace("</body>", `${footerInjection}\n</body>`);
  }

  if (!patched.includes("data-liax-published-chrome-patch")) {
    patched = patched.replace(
      "</style>",
      `    [data-liax-published-chrome-patch] { display: none; }
    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }
    html,
    body {
      max-width: 100%;
      overflow-x: hidden;
      scrollbar-width: none;
    }
    html::-webkit-scrollbar,
    body::-webkit-scrollbar {
      display: none;
    }
    .liax-public-logo,
    .liax-public-avatar {
      overflow: hidden;
    }
    .liax-public-shell,
    .liax-public-header,
    .liax-article-card,
    .liax-article-header,
    .liax-article-body,
    .liax-article-toc {
      min-width: 0;
      max-width: 100%;
    }
    .liax-public-header,
    .liax-article-card {
      width: 100%;
      max-width: 100vw;
    }
    .liax-public-sidebar-layer,
    .liax-public-sidebar-backdrop {
      width: 100vw;
      max-width: 100vw;
    }
    .liax-article-card {
      overflow-x: clip;
      padding-inline-end: clamp(280px, 22vw, 360px);
    }
    .liax-article-header,
    .liax-article-body,
    .liax-article-footer {
      width: min(980px, 100%);
    }
    .liax-article-header h1,
    .liax-article-body h1,
    .liax-article-body h2,
    .liax-article-body h3,
    .liax-article-body h4,
    .liax-article-body h5,
    .liax-article-body h6,
    .liax-article-body p,
    .liax-article-body li,
    .liax-article-toc a {
      overflow-wrap: anywhere;
    }
    .liax-article-body h2,
    .liax-article-body h3,
    .liax-article-body h4 {
      scroll-margin-top: 96px;
    }
    .liax-public-logo img,
    .liax-public-avatar img,
    .liax-article-body img,
    .liax-article-body video {
      max-width: 100%;
      height: auto;
    }
    .liax-public-logo img,
    .liax-public-avatar img {
      width: 100%;
      height: 100%;
    }

    .liax-public-logo img {
      object-fit: contain;
    }

    .liax-public-avatar img {
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
    .liax-article-body code {
      border: 1px solid rgb(80 86 124 / 54%);
      border-radius: 6px;
      background: #1a1b26;
      color: #c0caf5;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      padding: 0.1em 0.35em;
    }
    .liax-article-body pre,
    .liax-article-body table {
      max-width: 100%;
      overflow-x: auto;
    }
    .liax-article-body pre {
      position: relative;
      border: 1px solid #2f3549;
      border-radius: 8px;
      background: #1a1b26;
      color: #c0caf5;
      padding: 16px;
      box-shadow: inset 0 1px 0 rgb(255 255 255 / 4%);
      scrollbar-color: #3b4261 #1a1b26;
    }
    .liax-article-body pre code {
      display: block;
      border: 0;
      background: transparent;
      color: inherit;
      padding: 0;
    }
    .liax-code-frame {
      padding-top: 44px;
    }
    .liax-code-keyword {
      color: #bb9af7;
      font-weight: 760;
    }
    .liax-code-string {
      color: #9ece6a;
    }
    .liax-code-number {
      color: #ff9e64;
    }
    .liax-code-comment {
      color: #565f89;
      font-style: italic;
    }
    .liax-code-copy {
      position: absolute;
      top: 10px;
      right: 10px;
      border: 1px solid rgb(192 202 245 / 24%);
      border-radius: 6px;
      background: #24283b;
      color: #c0caf5;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      font-weight: 760;
      line-height: 1;
      padding: 7px 9px;
    }
    .liax-code-copy:hover,
    .liax-code-copy:focus-visible {
      border-color: #8ab895;
      color: #8ab895;
      outline: 0;
    }
    .liax-article-utility {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      align-items: center;
      margin-top: 18px;
      color: #6f6a5d;
      font-size: 14px;
      font-weight: 760;
    }
    .liax-article-utility a,
    .liax-article-neighbor-nav a {
      color: var(--color-accent);
      text-decoration: underline;
      text-underline-offset: 0.18em;
    }
    .liax-article-utility p {
      display: inline-flex;
      gap: 8px;
      margin: 0;
    }
    .liax-article-audience {
      display: inline-flex;
      width: max-content;
      max-width: 100%;
      align-items: center;
      gap: 8px;
      margin: 12px 0 0;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface-muted);
      color: var(--color-text);
      font-size: 13px;
      font-weight: 760;
      line-height: 1.2;
      padding: 6px 10px;
    }
    .liax-article-audience span {
      color: #6f6a5d;
      font-size: 12px;
      font-weight: 800;
    }
    .liax-article-audience strong {
      overflow-wrap: anywhere;
    }
    .liax-article-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }
    .liax-article-tags a {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface-muted);
      color: var(--color-text);
      font-size: 13px;
      font-weight: 760;
      line-height: 1;
      padding: 7px 10px;
      text-decoration: none;
    }
    .liax-article-tags a:hover,
    .liax-article-tags a:focus-visible {
      border-color: var(--color-accent);
      color: var(--color-accent);
      outline: 0;
    }
    .liax-article-neighbor-nav {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
      margin-top: 18px;
    }
    .liax-article-neighbor-nav a {
      display: grid;
      gap: 4px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface-muted);
      padding: 12px;
      text-decoration: none;
    }
    .liax-article-neighbor-nav span {
      color: #6f6a5d;
      font-size: 12px;
      font-weight: 760;
    }
    .liax-article-neighbor-nav strong {
      color: var(--color-text);
      overflow-wrap: anywhere;
    }
    .liax-article-toc {
      position: fixed;
      inset-block-start: 96px;
      inset-inline-end: clamp(18px, 3vw, 40px);
      z-index: 20;
      display: grid;
      gap: 10px;
      min-width: 0;
      width: clamp(220px, 20vw, 300px);
      max-height: calc(100vh - 120px);
      margin: 0;
      overflow-y: auto;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: color-mix(in srgb, var(--color-surface-muted) 94%, transparent);
      box-shadow: 0 18px 48px rgba(20, 20, 19, 0.12);
      padding: 14px 16px;
      backdrop-filter: blur(10px);
    }
    .liax-article-toc strong {
      font-size: 14px;
      font-weight: 820;
    }
    .liax-article-toc ol {
      display: grid;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .liax-article-toc li[data-level="3"] {
      padding-left: 16px;
    }
    .liax-article-toc li[data-level="4"] {
      padding-left: 32px;
    }
    .liax-article-toc a {
      color: var(--color-text);
      font-size: 14px;
      font-weight: 720;
      text-decoration: none;
    }
    .liax-article-toc a:hover,
    .liax-article-toc a:focus-visible {
      color: var(--color-accent);
      text-decoration: underline;
      text-underline-offset: 0.18em;
    }

    @media (max-width: 1080px) {
      .liax-article-card {
        padding-inline-end: clamp(16px, 4vw, 40px);
      }

      .liax-article-toc {
        position: sticky;
        inset-block-start: 84px;
        inset-inline-end: auto;
        width: min(360px, 100%);
        max-height: 42vh;
        margin: 0 0 clamp(22px, 4vw, 38px) auto;
      }
    }

    @media (max-width: 720px) {
      .liax-article-card {
        padding: 22px 16px 36px;
      }
      .liax-article-neighbor-nav {
        grid-template-columns: minmax(0, 1fr);
      }
      .liax-article-utility p {
        flex-wrap: wrap;
      }
    }
${renderPublicPolishCss()}
  </style>
  <meta data-liax-published-chrome-patch="true">`
    );
  }

  if (!patched.includes("data-liax-article-image-error-patch")) {
    patched = patched.replace(
      "</body>",
      `<script data-liax-article-image-error-patch="true">
document.querySelectorAll(".liax-public-header .liax-language-switch[data-language-switch-placeholder]").forEach((node, index) => {
  if (index > 0) {
    node.remove();
  }
});
document.querySelectorAll(".liax-article-body img").forEach((image) => {
  image.addEventListener("error", () => image.remove(), { once: true });
});
function liaxArticleText(key) {
  const isZh = document.documentElement.lang.toLowerCase().startsWith("zh");
  const text = {
    toc: isZh ? "标题目录" : "Contents",
    copy: isZh ? "复制" : "Copy",
    copied: isZh ? "已复制" : "Copied"
  };
  return text[key] || key;
}
function liaxArticleSlug(text, index) {
  const normalized = text.trim().toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu, "-").replace(/^-+|-+$/gu, "");
  return normalized || "section-" + (index + 1);
}
function liaxEscapeCode(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function liaxCodeClass(token) {
  if (/^\\/\\//.test(token) || /^\\/\\*/.test(token)) {
    return "liax-code-comment";
  }
  if (/^["']/.test(token)) {
    return "liax-code-string";
  }
  if (/^\\d/.test(token)) {
    return "liax-code-number";
  }
  return "liax-code-keyword";
}
function liaxHighlightCodeElement(code) {
  if (code.dataset.liaxHighlighted === "true" || code.querySelector(".liax-code-keyword, .liax-code-string, .liax-code-number, .liax-code-comment")) {
    return;
  }
  const source = code.textContent || "";
  const tokenPattern = /\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|\\b(?:async|await|break|case|catch|class|const|continue|default|else|export|extends|false|finally|for|from|function|if|import|interface|let|new|null|private|protected|public|return|static|switch|throw|true|try|type|undefined|var|void|while)\\b|\\b\\d+(?:\\.\\d+)?\\b/gu;
  let highlighted = "";
  let cursor = 0;
  source.replace(tokenPattern, (token, offset) => {
    highlighted += liaxEscapeCode(source.slice(cursor, offset));
    highlighted += '<span class="' + liaxCodeClass(token) + '">' + liaxEscapeCode(token) + "</span>";
    cursor = offset + token.length;
    return token;
  });
  highlighted += liaxEscapeCode(source.slice(cursor));
  code.innerHTML = highlighted;
  code.dataset.liaxHighlighted = "true";
}
function liaxEnhanceArticlePage() {
  const body = document.querySelector(".liax-article-body");
  if (!body) {
    return;
  }
  const headings = Array.from(body.querySelectorAll("h2, h3, h4"));
  if (headings.length > 0 && !document.querySelector(".liax-article-toc")) {
    const usedIds = new Set();
    const nav = document.createElement("nav");
    const title = document.createElement("strong");
    const list = document.createElement("ol");
    nav.className = "liax-article-toc";
    nav.setAttribute("aria-label", liaxArticleText("toc"));
    title.textContent = liaxArticleText("toc");
    headings.forEach((heading, index) => {
      const baseId = heading.id || liaxArticleSlug(heading.textContent || "", index);
      let nextId = baseId;
      let suffix = 2;
      while (usedIds.has(nextId) || (document.getElementById(nextId) && document.getElementById(nextId) !== heading)) {
        nextId = baseId + "-" + suffix;
        suffix += 1;
      }
      usedIds.add(nextId);
      heading.id = nextId;
      const item = document.createElement("li");
      const link = document.createElement("a");
      item.dataset.level = heading.tagName.slice(1);
      link.href = "#" + nextId;
      link.textContent = heading.textContent || nextId;
      item.append(link);
      list.append(item);
    });
    nav.append(title, list);
    const header = document.querySelector(".liax-article-header");
    if (header?.parentNode) {
      header.insertAdjacentElement("afterend", nav);
    } else {
      body.insertAdjacentElement("beforebegin", nav);
    }
  }
  body.querySelectorAll("pre").forEach((pre) => {
    const code = pre.querySelector("code");
    if (code) {
      liaxHighlightCodeElement(code);
    }
    if (pre.querySelector(".liax-code-copy")) {
      return;
    }
    pre.classList.add("liax-code-frame");
    const button = document.createElement("button");
    button.className = "liax-code-copy";
    button.type = "button";
    button.textContent = liaxArticleText("copy");
    button.addEventListener("click", async () => {
      const code = pre.querySelector("code")?.textContent || pre.textContent || "";
      try {
        await navigator.clipboard?.writeText(code);
        button.textContent = liaxArticleText("copied");
        window.setTimeout(() => {
          button.textContent = liaxArticleText("copy");
        }, 1400);
      } catch {}
    });
    pre.append(button);
  });
}
liaxEnhanceArticlePage();
</script>
</body>`
    );
  }

  return patched;
}

function includesCjk(value: string): boolean {
  return /[\u3400-\u9fff]/u.test(value);
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

function publicDataRepairLabel(locale: ArticleLocale): string {
  return locale === "zh-CN" ? "内容数据待修复" : "Content data needs repair";
}

function safePublicTitle(locale: ArticleLocale, title: string): { label: string; repaired: boolean } {
  if (!hasQuestionMarkMojibake(title)) {
    return { label: title, repaired: false };
  }

  return {
    label: locale === "zh-CN" ? "这篇内容的标题待修复" : "This title needs repair",
    repaired: true
  };
}

function safePublicSummary(summary: string): string {
  return hasQuestionMarkMojibake(summary) ? "" : summary;
}

type HomeContactItem = {
  href: string | null;
  label: string;
  value: string;
};

function contactHref(label: string, value: string): string | null {
  const normalizedLabel = label.toLowerCase();

  if (value.includes("@") && !/\s/.test(value)) {
    return `mailto:${value}`;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (normalizedLabel.includes("email") || normalizedLabel.includes("mail") || normalizedLabel.includes("邮箱")) {
    return `mailto:${value}`;
  }

  return null;
}

function isPlaceholderContactItem(label: string, value: string): boolean {
  const normalizedLabel = label.trim().toLowerCase();
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "hello@example.com") {
    return true;
  }

  return normalizedLabel === "qq" && normalizedValue === "123456";
}

function parseHomeContactItems(settings: SiteSettings, isZh: boolean): HomeContactItem[] {
  const localeKey = isZh ? "home.contactItems.zh-CN" : "home.contactItems.en-US";
  const legacyItems = readStringSetting(settings, "home.contactItems", "");
  const legacyFallback = legacyItems && (isZh || !includesCjk(legacyItems)) ? legacyItems : "";
  const rawItems = readStringSetting(settings, localeKey, legacyFallback);

  return rawItems
    .split(/\r?\n|,,/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separatorIndex = line.search(/[:：]/u);
      const label = separatorIndex >= 0 ? line.slice(0, separatorIndex).trim() : (isZh ? "联系" : "Contact");
      const value = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim() : line;

      return {
        href: contactHref(label, value),
        label: label || (isZh ? "联系" : "Contact"),
        value
      };
    })
    .filter((item) => item.value.length > 0 && !isPlaceholderContactItem(item.label, item.value));
}

function renderHomeContactItem(item: HomeContactItem): string {
  const valueHtml = item.href
    ? `<a class="liax-home-contact__value" href="${escapeHtml(item.href)}">${escapeHtml(item.value)}</a>`
    : `<span class="liax-home-contact__value">${escapeHtml(item.value)}</span>`;

  return `<span class="liax-home-contact__item">
          <span class="liax-home-contact__label">${escapeHtml(item.label)}</span>
          ${valueHtml}
        </span>`;
}

function renderHomeContactPanel(settings: SiteSettings, isZh: boolean): string {
  const items = parseHomeContactItems(settings, isZh);

  if (items.length === 0) {
    return `<aside class="liax-home-contact" aria-label="${escapeHtml(isZh ? "联系方式" : "Contact")}">
        <p class="liax-home-contact__empty">${escapeHtml(isZh ? "暂未配置公开联系方式。" : "No public contact methods are configured yet.")}</p>
      </aside>`;
  }

  return `<aside class="liax-home-contact" aria-label="${escapeHtml(isZh ? "联系方式" : "Contact")}">
${items.map((item) => `        ${renderHomeContactItem(item)}`).join("\n")}
      </aside>`;
}

export function renderHomePage(locale: ArticleLocale, prefix: LocalePrefix, settings: SiteSettings, avatarUrl: string | null = null): string {
  const isZh = locale === "zh-CN";
  const title = "Liax Space";
  const description = "Liax Space";
  const switchHtml = renderHomeLanguageSwitch(prefix);
  const alternatePrefix = prefix === "zh" ? "en" : "zh";
  const alternateLocale = alternatePrefix === "zh" ? "zh-CN" : "en-US";
  const signature = readStringSetting(settings, "home.signature", "Timeless Silent Vigil");
  const rawBrandInfo = readStringSetting(
    settings,
    "home.brandInfo",
    "Liax Space"
  );
  const hasLegacyBrandInfo = (rawBrandInfo.includes("温暖") && rawBrandInfo.includes("极简")) || /warm minimal content space/iu.test(rawBrandInfo);
  const brandInfo = hasLegacyBrandInfo ? "Liax Space" : rawBrandInfo;
  const rawIcpNumber = readStringSetting(settings, "home.icpNumber", "");
  const icpNumber = ["备案号待配置", "ICP pending", "ICP备案号"].includes(rawIcpNumber) ? "" : rawIcpNumber;
  const icpUrl = readUrlSetting(settings, "home.icpUrl", "https://beian.miit.gov.cn");
  const icpHtml = icpNumber
    ? `<a href="${escapeHtml(icpUrl)}" rel="noopener noreferrer" target="_blank">${escapeHtml(icpNumber)}</a>`
    : "";
  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="/${prefix}">
  <link rel="alternate" hreflang="${alternateLocale}" href="/${alternatePrefix}">
  ${renderFaviconLink(settings)}
  ${renderLogoPreviewTags(settings)}
  ${renderHeadInjection(settings, false)}
  <title>${escapeHtml(title)}</title>
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
${renderThemeCssVariables(settings)}
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

    html::-webkit-scrollbar,
    body::-webkit-scrollbar {
      display: none;
    }

    .liax-public-shell {
      box-sizing: border-box;
      display: grid;
      min-height: 100vh;
      grid-template-rows: auto 1fr auto;
      width: 100%;
      margin: 0;
      padding: 0;
    }

    .liax-public-header {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr) max-content;
      align-items: center;
      gap: clamp(12px, 2vw, 24px);
      box-sizing: border-box;
      width: 100%;
      height: 76px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
      padding: 12px clamp(18px, 3vw, 40px);
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
      justify-content: end;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .liax-language-switch {
      position: relative;
      z-index: 2;
      justify-content: center;
      width: 44px;
    }

    .liax-public-menu {
      display: grid;
      grid-template-columns: repeat(6, 86px);
      justify-content: flex-end;
      gap: 6px;
      min-width: 0;
      position: relative;
      z-index: 1;
    }

    .liax-public-menu a {
      flex: 0 0 auto;
      display: inline-flex;
      justify-content: center;
      width: 86px;
      padding: 6px 7px;
    }

    .liax-public-menu a,
    .liax-home-contact a {
      color: var(--color-text);
      font-size: 14px;
      font-weight: 720;
      text-decoration: none;
      white-space: nowrap;
    }

    .liax-public-menu a:hover,
    .liax-public-menu a:focus-visible,
    .liax-home-contact a:hover,
    .liax-home-contact a:focus-visible {
      color: var(--color-accent);
      text-decoration: underline;
      text-underline-offset: 0.18em;
    }

    .liax-public-header__tools {
      justify-content: flex-end;
    }

    .liax-button {
      display: inline-flex;
      min-height: 36px;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface-muted);
      color: var(--color-text);
      font: inherit;
      font-size: 14px;
      font-weight: 760;
      padding: 6px 11px;
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

    main {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(280px, 360px);
      align-items: center;
      gap: clamp(22px, 4vw, 52px);
      width: min(1560px, calc(100% - clamp(24px, 5vw, 80px)));
      margin: 0 auto;
      padding: clamp(34px, 7vh, 72px) 0 clamp(42px, 8vh, 88px);
    }

    main::before {
      content: "";
      position: absolute;
      inset: clamp(18px, 4vw, 46px) auto auto 0;
      width: min(380px, 46vw);
      height: 1px;
      background: linear-gradient(90deg, var(--color-accent), transparent);
      opacity: 0.48;
    }

    .liax-home-title {
      max-width: 820px;
      margin: 0;
      font-size: 88px;
      line-height: 1;
      letter-spacing: 0;
    }

    .liax-home-contact {
      box-sizing: border-box;
      display: grid;
      gap: 14px;
      justify-self: end;
      align-self: center;
      border: 1px solid rgb(199 194 185 / 58%);
      border-radius: 8px;
      background: rgb(255 255 255 / 62%);
      box-shadow: 0 10px 30px rgba(20, 20, 19, 0.035);
      padding: 18px 20px;
      width: 100%;
      max-width: 360px;
    }

    .liax-home-contact__item {
      display: grid;
      gap: 3px;
      min-width: 0;
    }

    .liax-home-contact__label {
      color: rgb(20 20 19 / 66%);
      font-size: 12px;
      font-weight: 820;
    }

    .liax-home-contact__value,
    .liax-home-contact a.liax-home-contact__value {
      max-width: 100%;
      overflow-wrap: anywhere;
      white-space: normal;
    }

    .liax-home-contact__empty {
      margin: 0;
      color: rgb(20 20 19 / 62%);
      font-size: 14px;
      font-weight: 720;
      line-height: 1.5;
    }

    .liax-home-footer {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      width: min(1560px, calc(100% - clamp(24px, 5vw, 80px)));
      margin: 0 auto;
      border-top: 1px solid var(--color-border);
      padding-top: 14px;
      color: var(--color-text);
      font-size: 14px;
      font-weight: 700;
    }

    .liax-home-footer a {
      color: var(--color-text);
      text-decoration: underline;
      text-underline-offset: 0.18em;
    }

    .liax-home-footer a:hover,
    .liax-home-footer a:focus-visible {
      color: var(--color-accent);
    }

    @media (max-width: 1120px) {
      main {
        grid-template-columns: 1fr;
        align-items: start;
      }

      .liax-home-contact {
        justify-self: start;
        max-width: 420px;
      }

      .liax-home-title {
        font-size: 64px;
      }
    }

    @media (max-width: 860px) {
      .liax-public-header,
      .liax-home-footer {
        grid-template-columns: 1fr;
      }

    .liax-public-header {
        grid-template-columns: max-content minmax(0, 1fr) max-content;
        height: 76px;
        min-height: 76px;
        gap: 10px;
        overflow: visible;
        padding: 10px 14px;
        scrollbar-width: none;
      }

      .liax-public-header::-webkit-scrollbar {
        display: none;
      }

      .liax-public-header__center,
      .liax-public-header__tools {
        align-items: center;
        flex: 0 0 auto;
        flex-direction: row;
      }

      .liax-public-header__center {
        grid-template-columns: 44px;
      }

      .liax-public-menu {
        display: none;
      }

      main {
        align-items: start;
        gap: 22px;
        padding: 34px 0 52px;
      }

      .liax-home-contact {
        justify-self: start;
        width: 100%;
        box-sizing: border-box;
      }

      .liax-home-title {
        max-width: 100%;
        font-size: 40px;
        line-height: 1.05;
      }

      .liax-home-footer {
        display: grid;
        width: calc(100% - 28px);
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
      <a class="liax-public-brand" href="/${prefix}">
        ${renderPublicLogo(settings)}
        <span>Liax Space</span>
      </a>
      <div class="liax-public-header__center">
        <nav class="liax-public-menu" aria-label="Primary">
          ${renderPublicMenuLinks(prefix, isZh)}
        </nav>
        ${switchHtml}
      </div>
      <div class="liax-public-header__tools">
        ${renderPublicSearchForm(prefix, isZh, "inline")}
        ${renderPublicMenuToggle(isZh)}
        ${renderPublicAvatar(avatarUrl)}
      </div>
    </header>
    ${renderPublicSidebar(prefix, isZh)}
    <main>
      <section>
        <h1 class="liax-home-title">${escapeHtml(signature)}</h1>
      </section>
      ${renderHomeContactPanel(settings, isZh)}
    </main>
    <footer class="liax-home-footer">
      <span>${escapeHtml(brandInfo)}</span>
      ${icpHtml}
    </footer>
  </div>
${renderFooterInjection(settings)}
${renderLanguageSwitchScript()}
</body>
</html>`;
}

const publicSectionLabels = {
  archives: { en: "Archives", zh: "归档" },
  contact: { en: "Contact", zh: "联系" },
  guestbook: { en: "Guestbook", zh: "留言" },
  moments: { en: "Moments", zh: "瞬间" },
  posts: { en: "Articles", zh: "文章" },
  tags: { en: "Tags", zh: "标签" }
} as const;

type PublicSection = keyof typeof publicSectionLabels;
type RenderablePublicSection = PublicSection | "not-found";

function isPublicSection(value: string): value is PublicSection {
  return value in publicSectionLabels;
}

function formatPublicArticleCount(locale: ArticleLocale, count: number): string {
  if (locale === "zh-CN") {
    return `${count} 篇文章`;
  }

  return `${count} ${count === 1 ? "article" : "articles"}`;
}

function formatPublicVisitCount(locale: ArticleLocale, count: number): string {
  if (locale === "zh-CN") {
    return `${count} 阅读`;
  }

  return `${count} ${count === 1 ? "read" : "reads"}`;
}

type LocalizedPublicTag = {
  articleCount: number;
  createdAt: Date;
  id: number;
  name: string;
  slug: string;
};

function compareLocalizedPublicTags(locale: ArticleLocale, left: LocalizedPublicTag, right: LocalizedPublicTag): number {
  const articleCountDelta = right.articleCount - left.articleCount;

  if (articleCountDelta !== 0) {
    return articleCountDelta;
  }

  const createdAtDelta = right.createdAt.getTime() - left.createdAt.getTime();

  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  return left.name.localeCompare(right.name, locale);
}

function formatPublicTagBadge(locale: ArticleLocale, tag: LocalizedPublicTag, index: number): string {
  if (index === 0) {
    return locale === "zh-CN" ? "热门" : "Popular";
  }

  if (tag.articleCount > 1) {
    return locale === "zh-CN" ? "活跃" : "Active";
  }

  return locale === "zh-CN" ? "有内容" : "In use";
}

export function renderTagCards(locale: ArticleLocale, tags: TagDetail[]): string {
  const localizedTags = tags.flatMap((tagDetail) => {
    const translation = tagDetail.translations.find((item) => item.locale === locale);

    return translation ? [{
      articleCount: tagDetail.articleCounts?.[locale] ?? 0,
      createdAt: tagDetail.tag.createdAt,
      id: tagDetail.tag.id,
      name: translation.name,
      slug: translation.slug
    }] : [];
  });

  const visibleTags = localizedTags
    .filter((tag) => tag.articleCount > 0)
    .sort((left, right) => compareLocalizedPublicTags(locale, left, right));

  if (visibleTags.length === 0) {
    return `<p class="liax-section-empty">${locale === "zh-CN" ? "当前语言还没有标签。" : "No tags are available in this language yet."}</p>`;
  }

  return `<ul class="liax-tag-grid">
${visibleTags.map((tag, index) => {
    const tagClass = index === 0 ? "liax-tag-grid__link liax-tag-grid__link--featured" : "liax-tag-grid__link";
    return `        <li><a class="${tagClass}" href="/${locale === "zh-CN" ? "zh" : "en"}/tags/${encodeURIComponent(tag.slug)}"><span class="liax-tag-grid__mark">#</span><strong>${escapeHtml(tag.name)}</strong><em class="liax-tag-grid__badge">${escapeHtml(formatPublicTagBadge(locale, tag, index))}</em><code>${escapeHtml(tag.slug)}</code><small>${escapeHtml(formatPublicArticleCount(locale, tag.articleCount))}</small></a></li>`;
  }).join("\n")}
      </ul>`;
}

export function renderArticleCards(locale: ArticleLocale, prefix: LocalePrefix, articles: SearchResult[], emptyLabel: string): string {
  if (articles.length === 0) {
    return `<p class="liax-section-empty">${escapeHtml(emptyLabel)}</p>`;
  }

  return `<div class="liax-article-list">
${articles.map((article) => {
  const dateLabel = article.publishedAt ? new Date(article.publishedAt).toISOString().slice(0, 10) : "";
  const title = safePublicTitle(locale, article.title);
  const summary = safePublicSummary(article.summary ?? article.seoDescription ?? "");

  return `        <a class="liax-article-card" href="/${prefix}/posts/${encodeURIComponent(article.slug)}">
          <strong>${escapeHtml(title.label)}</strong>
          <span class="liax-article-meta">
            <time datetime="${escapeHtml(dateLabel)}">${escapeHtml(dateLabel)}</time>
            <span>${escapeHtml(formatPublicVisitCount(locale, article.visitCount))}</span>
          </span>
          ${title.repaired ? `<span class="liax-data-quality-note">${escapeHtml(publicDataRepairLabel(locale))}</span>` : ""}
          ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
        </a>`;
}).join("\n")}
      </div>`;
}

export function renderArchiveBody(locale: ArticleLocale, prefix: LocalePrefix, articles: SearchResult[]): string {
  const isZh = locale === "zh-CN";

  if (articles.length === 0) {
    return `<p class="liax-section-empty">${escapeHtml(isZh ? "当前语言还没有已发布文章。" : "No published articles are available in this language yet.")}</p>`;
  }

  const grouped = new Map<string, SearchResult[]>();

  for (const article of articles) {
    const date = article.publishedAt ? new Date(article.publishedAt) : null;
    const key = date && Number.isFinite(date.getTime())
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      : (isZh ? "未注明时间" : "Undated");
    grouped.set(key, [...(grouped.get(key) ?? []), article]);
  }

  return `<div class="liax-archive-timeline">
${[...grouped.entries()].map(([groupLabel, groupArticles]) => `        <section class="liax-archive-group">
          <h2><span>${escapeHtml(groupLabel)}</span><small>${escapeHtml(formatPublicArticleCount(locale, groupArticles.length))}</small></h2>
          <ol>
${groupArticles.map((article) => {
  const date = article.publishedAt ? new Date(article.publishedAt) : null;
  const dateLabel = date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "";
  const title = safePublicTitle(locale, article.title);

  return `            <li>
              <a href="/${prefix}/posts/${encodeURIComponent(article.slug)}">
                <time datetime="${escapeHtml(dateLabel)}">${escapeHtml(dateLabel || (isZh ? "未注明" : "Undated"))}</time>
                <strong>${escapeHtml(title.label)}</strong>
                ${title.repaired ? `<span class="liax-data-quality-note">${escapeHtml(publicDataRepairLabel(locale))}</span>` : ""}
              </a>
            </li>`;
}).join("\n")}
          </ol>
        </section>`).join("\n")}
      </div>`;
}

function renderPostsBody(locale: ArticleLocale, prefix: LocalePrefix, articles: SearchResult[]): string {
  const isZh = locale === "zh-CN";
  const intro = isZh ? "当前语言下已发布的文章。" : "Published articles in the current language.";
  const emptyLabel = isZh ? "当前语言还没有已发布文章。" : "No published articles are available in this language yet.";

  return `<p class="liax-section-description">${escapeHtml(intro)}</p>
      ${renderArticleCards(locale, prefix, articles, emptyLabel)}`;
}

function renderTagDetailBody(locale: ArticleLocale, prefix: LocalePrefix, tagName: string, tagSlug: string, articles: SearchResult[]): string {
  const isZh = locale === "zh-CN";
  const emptyLabel = isZh ? "此标签下还没有已发布文章。" : "No published articles are available for this tag yet.";

  return `<p class="liax-section-eyebrow">${isZh ? "标签" : "Tag"}</p>
      <p class="liax-section-description">${escapeHtml(isZh ? "当前正在浏览此标签下的内容集合。" : "You are viewing the content collection for this tag.")}</p>
      <div class="liax-tag-detail-card">
        <span>#</span>
        <strong>${escapeHtml(tagName)}</strong>
        <code>${escapeHtml(tagSlug)}</code>
      </div>
      ${renderArticleCards(locale, prefix, articles, emptyLabel)}
      <a class="liax-section-back" href="/${prefix}/tags">${escapeHtml(isZh ? "返回全部标签" : "Back to all tags")}</a>`;
}

export function renderMomentsBody(locale: ArticleLocale, moments: Moment[], options: RenderMomentsOptions = {}): string {
  const isZh = locale === "zh-CN";
  const shouldRenderImage = options.shouldRenderImage ?? (() => true);

  if (moments.length === 0) {
    return `<p class="liax-section-empty">${isZh ? "当前语言还没有已发布瞬间。" : "No published moments are available in this language yet."}</p>`;
  }

  return `<p class="liax-section-description">${escapeHtml(isZh ? "短内容动态，只显示当前语言已发布内容。" : "Short updates. Only published content in the current language is shown.")}</p>
      <div class="liax-moment-list">
${moments.map((moment) => {
  const date = moment.publishedAt ?? moment.createdAt;
  const dateLabel = date.toISOString().slice(0, 10);

  const renderableImages = moment.images.filter((image) => shouldRenderImage(image));
  const images = renderableImages.length > 0
    ? `
          <div class="liax-moment-images">
${renderableImages.map((image) => `            <img alt="" loading="lazy" onerror="const p=this.parentElement;this.remove();if(p&&!p.querySelector('img'))p.remove();" src="${escapeHtml(image)}">`).join("\n")}
          </div>`
    : "";

  return `        <article class="liax-moment-card">
          <p>${escapeHtml(moment.content)}</p>
${images}
          <time datetime="${escapeHtml(date.toISOString())}">${escapeHtml(dateLabel)}</time>
        </article>`;
}).join("\n")}
      </div>`;
}

type GuestbookFormValues = {
  authorName: string;
  email: string;
  content: string;
  notifyOnly: boolean;
};

type GuestbookFormState = {
  errors?: string[];
  submitted?: "public" | "private";
  values?: Partial<GuestbookFormValues>;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function readGuestbookSubmitted(value: unknown): "public" | "private" | undefined {
  const submitted = Array.isArray(value) ? value[0] : value;
  return submitted === "public" || submitted === "private" ? submitted : undefined;
}

function parseGuestbookForm(body: unknown, locale: ArticleLocale): {
  errors: string[];
  input: CreateGuestbookEntryInput | null;
  values: GuestbookFormValues;
} {
  const isZh = locale === "zh-CN";
  const authorName = readBodyString(body, "authorName").trim();
  const email = readBodyString(body, "email").trim().toLowerCase();
  const content = readBodyString(body, "content").trim();
  const notifyOnly = readBodyBoolean(body, "notifyOnly");
  const errors: string[] = [];

  if (!authorName) {
    errors.push(isZh ? "请填写昵称。" : "Name is required.");
  } else if (authorName.length > 80) {
    errors.push(isZh ? "昵称不能超过 80 个字符。" : "Name must be 80 characters or fewer.");
  }

  if (email && (email.length > 255 || !emailPattern.test(email))) {
    errors.push(isZh ? "请填写有效邮箱，或留空。" : "Enter a valid email address, or leave it blank.");
  }

  if (!content) {
    errors.push(isZh ? "请填写留言内容。" : "Message is required.");
  } else if (content.length > 1000) {
    errors.push(isZh ? "留言不能超过 1000 个字符。" : "Message must be 1000 characters or fewer.");
  }

  const values = { authorName, content, email, notifyOnly };

  if (errors.length > 0) {
    return { errors, input: null, values };
  }

  return {
    errors,
    input: {
      authorName,
      content,
      email: email || null,
      isPublic: !notifyOnly,
      locale,
      notifyOnly
    },
    values
  };
}

function renderGuestbookStatus(locale: ArticleLocale, state: GuestbookFormState): string {
  const isZh = locale === "zh-CN";

  if (state.errors?.length) {
    return `<div class="liax-guestbook-alert liax-guestbook-alert--error" role="alert">
          <strong>${isZh ? "提交失败" : "Submission failed"}</strong>
          <ul>
${state.errors.map((error) => `            <li>${escapeHtml(error)}</li>`).join("\n")}
          </ul>
        </div>`;
  }

  if (state.submitted === "public") {
    return `<p class="liax-guestbook-alert" role="status">${isZh ? "留言已发布。" : "Your message is now public."}</p>`;
  }

  if (state.submitted === "private") {
    return `<p class="liax-guestbook-alert" role="status">${isZh ? "留言已提交给站主，不会公开展示。" : "Your private message has been submitted and will not be shown publicly."}</p>`;
  }

  return "";
}

function renderGuestbookEntries(locale: ArticleLocale, entries: GuestbookEntry[]): string {
  const isZh = locale === "zh-CN";

  if (entries.length === 0) {
    return `<p class="liax-section-empty">${isZh ? "暂无公开留言。" : "No public messages yet."}</p>`;
  }

  return `<div class="liax-guestbook-list" aria-label="${isZh ? "公开留言" : "Public messages"}">
${entries.map((entry) => {
  const dateLabel = entry.createdAt.toISOString().slice(0, 10);
  const repaired = hasQuestionMarkMojibake(entry.content);
  const content = repaired ? (isZh ? "这条留言内容待修复。" : "This message needs repair.") : entry.content;

  return `        <article class="liax-guestbook-entry">
          <header>
            <strong>${escapeHtml(entry.authorName)}</strong>
            <time datetime="${escapeHtml(entry.createdAt.toISOString())}">${escapeHtml(dateLabel)}</time>
          </header>
          ${repaired ? `<span class="liax-data-quality-note">${escapeHtml(publicDataRepairLabel(locale))}</span>` : ""}
          <p>${escapeHtml(content)}</p>
        </article>`;
}).join("\n")}
      </div>`;
}

export function renderGuestbookBody(
  locale: ArticleLocale,
  prefix: LocalePrefix,
  entries: GuestbookEntry[],
  state: GuestbookFormState = {}
): string {
  const isZh = locale === "zh-CN";
  const values = state.values ?? {};
  const notifyOnlyChecked = values.notifyOnly ? " checked" : "";
  const nameInvalid = isZh ? "请填写昵称。" : "Please enter your name.";
  const emailInvalid = isZh ? "请填写正确邮箱，或留空。" : "Enter a valid email address, or leave it empty.";
  const messageInvalid = isZh ? "请填写留言内容。" : "Please enter a message.";

  return `<p class="liax-section-description">${escapeHtml(isZh ? "邮箱不会在前台公开。公开留言会自动通过并展示；重要留言可选择只发送给站主。" : "Email addresses are never shown publicly. Public messages are displayed immediately; important notes can be sent only to the site owner.")}</p>
      <div class="liax-guestbook-layout">
        <section class="liax-guestbook-compose" aria-label="${escapeHtml(isZh ? "发布留言" : "Write a message")}">
          ${renderGuestbookStatus(locale, state)}
          <form class="liax-guestbook-form" action="/${prefix}/guestbook" method="post">
            <label>
              <span>${isZh ? "昵称" : "Name"}</span>
              <input name="authorName" autocomplete="name" maxlength="80" required oninvalid="this.setCustomValidity('${escapeHtml(nameInvalid)}')" oninput="this.setCustomValidity('')" value="${escapeHtml(values.authorName ?? "")}">
            </label>
            <label>
              <span>${isZh ? "邮箱" : "Email"}</span>
              <input name="email" autocomplete="email" maxlength="255" type="email" oninvalid="this.setCustomValidity('${escapeHtml(emailInvalid)}')" oninput="this.setCustomValidity('')" value="${escapeHtml(values.email ?? "")}">
            </label>
            <label class="liax-guestbook-form__message">
              <span>${isZh ? "留言" : "Message"}</span>
              <textarea name="content" maxlength="1000" required rows="2" oninvalid="this.setCustomValidity('${escapeHtml(messageInvalid)}')" oninput="this.setCustomValidity('')">${escapeHtml(values.content ?? "")}</textarea>
            </label>
            <label class="liax-guestbook-form__notify">
              <input name="notifyOnly" type="checkbox" value="true"${notifyOnlyChecked}>
              <span>${isZh ? "仅发送给站主" : "Only send to the site owner"}</span>
            </label>
            <p class="liax-guestbook-form__help">${escapeHtml(isZh ? "勾选后这条留言不会在前台公开展示，会作为私密留言保存给站主查看。" : "When checked, this message is saved as private and will not appear on the public page.")}</p>
            <button type="submit">${isZh ? "提交留言" : "Submit message"}</button>
          </form>
        </section>
        <section class="liax-guestbook-stream" aria-label="${escapeHtml(isZh ? "公开留言" : "Public messages")}">
          <h2 class="liax-guestbook-list-title">${isZh ? "公开留言" : "Public messages"}</h2>
          ${renderGuestbookEntries(locale, entries)}
        </section>
      </div>`;
}

export function renderContactBody(locale: ArticleLocale, settings: SiteSettings): string {
  const isZh = locale === "zh-CN";
  const items = parseHomeContactItems(settings, isZh);

  if (items.length === 0) {
    return `<p class="liax-section-empty">${escapeHtml(isZh ? "暂未配置公开联系方式。" : "No public contact methods are configured yet.")}</p>`;
  }

  return `<p class="liax-section-description">${escapeHtml(isZh ? "这些联系方式由站点设置统一维护。" : "These contact methods are managed from site settings.")}</p>
      <div class="liax-contact-list" aria-label="${escapeHtml(isZh ? "联系方式" : "Contact methods")}">
${items.map((item) => {
  const valueHtml = item.href
    ? `<a href="${escapeHtml(item.href)}">${escapeHtml(item.value)}</a>`
    : `<span>${escapeHtml(item.value)}</span>`;

  return `        <article class="liax-contact-card">
          <strong>${escapeHtml(item.label)}</strong>
          ${valueHtml}
        </article>`;
}).join("\n")}
      </div>`;
}

export function renderPublicSectionPage(
  locale: ArticleLocale,
  prefix: LocalePrefix,
  section: RenderablePublicSection,
  bodyHtml?: string,
  settings: SiteSettings = {},
  avatarUrl: string | null = null
): string {
  const isZh = locale === "zh-CN";
  const label = section === "not-found" ? (isZh ? "页面未找到" : "Page not found") : (isZh ? publicSectionLabels[section].zh : publicSectionLabels[section].en);
  const description = section === "not-found"
    ? (isZh ? "没有找到当前语言下的公开页面。" : "The public page for the current language was not found.")
    : (isZh ? `${label}页面已接入公开导航。` : `${label} is wired into the public navigation.`);
  const alternatePrefix = prefix === "zh" ? "en" : "zh";
  const alternateLocale = alternatePrefix === "zh" ? "zh-CN" : "en-US";
  const switchHtml = renderHomeLanguageSwitch(prefix);

  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="/${prefix}/${section}">
  <link rel="alternate" hreflang="${alternateLocale}" href="/${alternatePrefix}/${section}">
  ${renderFaviconLink(settings)}
  ${renderLogoPreviewTags(settings)}
  ${renderHeadInjection(settings, false)}
  <title>${escapeHtml(label)} · Liax Space</title>
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
${renderThemeCssVariables(settings)}
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

    .liax-section-card {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
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
      font-weight: 760;
      text-decoration: none;
      white-space: nowrap;
    }

    .liax-public-menu a {
      color: var(--color-text);
      flex: 0 0 auto;
      display: inline-flex;
      justify-content: center;
      width: 86px;
      padding: 6px 7px;
      font-weight: 760;
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

    .liax-public-menu {
      display: grid;
      grid-template-columns: repeat(6, 86px);
      justify-content: end;
      gap: 6px;
      min-width: 0;
    }

    .liax-public-header__center {
      display: grid;
      grid-template-columns: minmax(0, auto) 44px;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .liax-language-switch {
      position: relative;
      z-index: 2;
      width: 44px;
      flex-wrap: nowrap;
      justify-content: center;
    }

    .liax-public-menu {
      position: relative;
      z-index: 1;
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

    .liax-section-card {
      box-sizing: border-box;
      width: min(1440px, calc(100% - clamp(24px, 5vw, 80px)));
      margin: 18px auto 42px;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      padding: clamp(20px, 3vw, 34px) 0;
    }

    .liax-section-card h1 {
      margin: 0 0 14px;
      font-size: clamp(34px, 5vw, 58px);
      line-height: 1.04;
      letter-spacing: 0;
    }

    .liax-section-card p {
      max-width: 680px;
      margin: 0;
      line-height: 1.7;
    }

    .liax-section-eyebrow {
      color: #9e4b31;
      font-size: 13px;
      font-weight: 800;
    }

    .liax-section-description {
      margin-bottom: 18px;
    }

    .liax-section-empty {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: rgb(255 255 255 / 70%);
      color: #504b43;
      padding: 18px 20px;
      position: relative;
    }

    .liax-section-empty::before {
      content: none;
    }

    .liax-section-card[data-section="posts"] {
      background: transparent;
    }

    .liax-section-card[data-section="tags"] {
      background: transparent;
    }

    .liax-section-card[data-section="moments"] {
      background: transparent;
    }

    .liax-section-card[data-section="archives"] {
      background: transparent;
    }

    .liax-section-card[data-section="guestbook"] {
      background: transparent;
    }

    .liax-section-card[data-section="tags"] .liax-section-empty,
    .liax-section-card[data-section="moments"] .liax-section-empty,
    .liax-section-card[data-section="guestbook"] .liax-section-empty,
    .liax-section-card[data-section="archives"] .liax-section-empty {
      display: grid;
      min-height: 92px;
      align-content: center;
      box-shadow: inset 0 1px 0 rgb(255 255 255 / 64%);
      font-weight: 760;
    }

    .liax-section-card[data-section="tags"] .liax-section-empty {
      background: rgb(255 255 255 / 70%);
    }

    .liax-section-card[data-section="moments"] .liax-section-empty {
      background: rgb(255 255 255 / 70%);
    }

    .liax-section-card[data-section="archives"] .liax-section-empty {
      background: rgb(255 255 255 / 70%);
    }

    .liax-contact-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
      margin-top: 24px;
    }

    .liax-contact-card {
      display: grid;
      gap: 8px;
      min-width: 0;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface-muted);
      padding: 18px;
    }

    .liax-contact-card strong {
      color: #6f6a5d;
      font-size: 13px;
      font-weight: 820;
    }

    .liax-contact-card a,
    .liax-contact-card span {
      min-width: 0;
      color: var(--color-text);
      font-size: 18px;
      font-weight: 760;
      overflow-wrap: anywhere;
      text-decoration: none;
    }

    .liax-contact-card a:hover,
    .liax-contact-card a:focus-visible {
      color: var(--color-accent);
      text-decoration: underline;
      text-underline-offset: 0.18em;
    }

    .liax-tag-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      list-style: none;
      margin: 24px 0 0;
      padding: 0;
    }

    .liax-tag-grid a {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) max-content;
      align-items: start;
      gap: 8px 10px;
      min-height: 88px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      color: var(--color-text);
      font-weight: 760;
      padding: 14px;
      text-decoration: none;
      transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
    }

    .liax-tag-grid__link--featured {
      border-color: rgb(217 119 87 / 52%);
      background: var(--color-surface-muted);
    }

    .liax-tag-grid a:hover,
    .liax-tag-grid a:focus-visible {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px rgba(217, 119, 87, 0.16);
      outline: 0;
      transform: translateY(-1px);
    }

    .liax-tag-grid__mark {
      grid-row: span 3;
      color: var(--color-accent);
      font-size: 22px;
      font-weight: 900;
      line-height: 1;
    }

    .liax-tag-grid strong {
      min-width: 0;
      overflow-wrap: anywhere;
      font-size: 18px;
      line-height: 1.25;
    }

    .liax-tag-grid__badge {
      justify-self: end;
      border: 1px solid rgb(217 119 87 / 32%);
      border-radius: 999px;
      background: rgb(217 119 87 / 10%);
      color: var(--color-accent);
      font-size: 11px;
      font-style: normal;
      font-weight: 820;
      line-height: 1;
      padding: 5px 7px;
      white-space: nowrap;
    }

    .liax-tag-grid code {
      grid-column: 2 / 4;
      min-width: 0;
      overflow-wrap: anywhere;
      color: #6f6a5d;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 13px;
    }

    .liax-tag-grid small {
      grid-column: 2 / 4;
      color: #6f6a5d;
      font-size: 13px;
      font-weight: 760;
    }

    .liax-article-list {
      display: grid;
      gap: 10px;
      margin-top: 24px;
    }

    .liax-article-card {
      display: grid;
      grid-template-columns: minmax(0, 1fr) max-content;
      align-items: start;
      gap: 6px 18px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: rgb(255 255 255 / 82%);
      color: var(--color-text);
      box-shadow: 0 8px 22px rgb(20 20 19 / 4%);
      padding: 18px 20px;
      text-decoration: none;
      transition: background 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
    }

    .liax-article-card::before {
      content: "";
      grid-column: 1 / -1;
      width: 42px;
      height: 3px;
      border-radius: 999px;
      background: rgb(217 119 87 / 36%);
    }

    .liax-article-card strong {
      grid-column: 1;
      color: var(--color-text);
      font-size: 18px;
      font-weight: 800;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .liax-article-card:hover,
    .liax-article-card:focus-visible {
      border-color: var(--color-accent);
      background: #fffdfa;
      box-shadow: 0 12px 28px rgba(20, 20, 19, 0.07);
      outline: 0;
      transform: translateY(-1px);
    }

    .liax-article-card:hover strong,
    .liax-article-card:focus-visible strong {
      color: var(--color-accent);
      text-decoration: underline;
      text-underline-offset: 0.18em;
    }

    .liax-article-meta,
    .liax-article-card p {
      margin: 0;
      color: var(--color-text);
    }

    .liax-article-meta {
      display: flex;
      flex-wrap: wrap;
      grid-column: 2;
      justify-self: end;
      gap: 8px 12px;
      color: #6f6a5d;
      font-size: 13px;
      font-weight: 760;
      white-space: nowrap;
    }

    .liax-article-card p {
      grid-column: 1 / -1;
      max-width: 76ch;
      color: #504b43;
      line-height: 1.6;
    }

    .liax-archive-timeline {
      display: grid;
      gap: 18px;
      max-width: 860px;
      margin-top: 20px;
    }

    .liax-archive-group {
      display: grid;
      gap: 9px;
    }

    .liax-archive-group h2 {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 12px;
      align-items: baseline;
      margin: 0;
      color: var(--color-accent);
      font-size: 17px;
    }

    .liax-archive-group h2 small {
      color: #6f6a5d;
      font-size: 13px;
      font-weight: 760;
    }

    .liax-archive-group ol {
      display: grid;
      gap: 0;
      margin: 0;
      padding: 0;
      list-style: none;
      border: 1px solid rgb(199 194 185 / 62%);
      border-radius: 8px;
      background: rgb(255 255 255 / 58%);
      box-shadow: none;
      overflow: hidden;
    }

    .liax-archive-group li {
      border-bottom: 1px solid var(--color-border);
    }

    .liax-archive-group a {
      display: grid;
      grid-template-columns: 96px minmax(0, 1fr);
      gap: 12px;
      align-items: baseline;
      color: var(--color-text);
      min-height: 38px;
      padding: 8px 12px;
      text-decoration: none;
    }

    .liax-archive-group a:hover strong,
    .liax-archive-group a:focus-visible strong {
      color: var(--color-accent);
      text-decoration: underline;
      text-underline-offset: 0.18em;
    }

    .liax-archive-group time {
      color: #6f6a5d;
      font-size: 13px;
      font-weight: 760;
    }

    .liax-archive-group strong {
      font-size: 15px;
      overflow-wrap: anywhere;
    }

    .liax-moment-list {
      display: grid;
      gap: 14px;
      margin-top: 24px;
    }

    .liax-moment-card {
      position: relative;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: linear-gradient(135deg, #ffffff, var(--color-surface-muted));
      box-shadow: 0 8px 22px rgb(20 20 19 / 4%);
      padding: 18px 18px 18px 46px;
    }

    .liax-moment-card::before {
      content: "";
      position: absolute;
      inset-block-start: 22px;
      inset-inline-start: 18px;
      width: 12px;
      height: 12px;
      border: 3px solid rgb(217 119 87 / 28%);
      border-radius: 999px;
      background: #ffffff;
    }

    .liax-moment-card p {
      margin: 0 0 12px;
      max-width: none;
      white-space: pre-wrap;
    }

    .liax-moment-images {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 10px;
      margin: 14px 0;
    }

    .liax-moment-images img {
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid var(--color-border);
      background: var(--color-surface);
    }

    .liax-moment-card time {
      color: #6f6a5d;
      font-size: 13px;
      font-weight: 760;
    }

    .liax-guestbook-layout {
      display: grid;
      grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
      align-items: start;
      gap: 24px;
      margin-top: 22px;
    }

    .liax-guestbook-compose,
    .liax-guestbook-stream {
      min-width: 0;
    }

    .liax-guestbook-form {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
      max-width: none;
      margin-top: 0;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: rgb(255 255 255 / 78%);
      box-shadow: 0 10px 28px rgb(20 20 19 / 4%);
      padding: 16px;
    }

    .liax-guestbook-form label {
      display: grid;
      gap: 8px;
      color: var(--color-text);
      font-weight: 760;
    }

    .liax-guestbook-form input,
    .liax-guestbook-form textarea {
      box-sizing: border-box;
      width: 100%;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      color: var(--color-text);
      font: inherit;
      line-height: 1.5;
      padding: 10px 12px;
    }

    .liax-guestbook-form input:focus,
    .liax-guestbook-form textarea:focus {
      border-color: #5f7a50;
      box-shadow: 0 0 0 3px rgb(95 122 80 / 18%);
      outline: 0;
    }

    .liax-guestbook-form input[aria-invalid="true"],
    .liax-guestbook-form textarea[aria-invalid="true"] {
      border-color: #b85c48;
      box-shadow: 0 0 0 3px rgb(184 92 72 / 16%);
    }

    .liax-guestbook-form textarea {
      min-height: 58px;
      max-height: 132px;
      resize: vertical;
    }

    .liax-guestbook-form__message,
    .liax-guestbook-form__notify,
    .liax-guestbook-form__help,
    .liax-guestbook-form button {
      grid-column: 1 / -1;
    }

    .liax-guestbook-form__notify {
      display: flex;
      grid-template-columns: none;
      align-items: center;
      gap: 10px;
      font-weight: 760;
    }

    .liax-guestbook-form__notify input {
      width: 18px;
      height: 18px;
      margin: 0;
      accent-color: var(--color-accent);
    }

    .liax-guestbook-form__help {
      margin: -4px 0 0;
      max-width: none;
      color: #6f6a5d;
      font-size: 13px;
    }

    .liax-guestbook-form__validation {
      grid-column: 1 / -1;
      margin: 0;
      border: 1px solid #d79682;
      border-radius: 8px;
      background: #fff0ec;
      color: #7d301f;
      font-size: 13px;
      font-weight: 760;
      padding: 10px 12px;
    }

    .liax-guestbook-form__validation:empty {
      display: none;
    }

    .liax-guestbook-form button {
      justify-self: start;
      border: 1px solid var(--color-brand);
      border-radius: 8px;
      background: var(--color-brand);
      color: var(--color-brand-text);
      cursor: pointer;
      font: inherit;
      font-weight: 800;
      padding: 10px 16px;
      transition: background 160ms ease, box-shadow 160ms ease, transform 160ms ease;
    }

    .liax-guestbook-form button:hover,
    .liax-guestbook-form button:focus-visible {
      box-shadow: 0 10px 24px rgb(201 100 66 / 20%);
      outline: 0;
      transform: translateY(-1px);
    }

    .liax-guestbook-alert {
      box-sizing: border-box;
      max-width: 760px;
      margin: 18px 0 0;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: #eef5e7;
      padding: 14px 16px;
    }

    .liax-guestbook-alert--error {
      background: #fff0ec;
      border-color: #d79682;
    }

    .liax-guestbook-alert strong {
      display: block;
      margin-bottom: 8px;
    }

    .liax-guestbook-alert ul {
      margin: 0;
      padding-left: 20px;
    }

    .liax-guestbook-list-title {
      margin: 0 0 14px;
      font-size: 22px;
      line-height: 1.2;
      letter-spacing: 0;
    }

    .liax-guestbook-list {
      display: grid;
      gap: 14px;
      margin-top: 0;
    }

    .liax-guestbook-entry {
      border: 1px solid rgb(199 194 185 / 62%);
      border-radius: 8px;
      background: rgb(255 255 255 / 72%);
      box-shadow: none;
      padding: 14px 16px;
    }

    .liax-guestbook-entry header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 8px 16px;
      margin-bottom: 10px;
    }

    .liax-guestbook-entry time {
      color: #6f6a5d;
      font-size: 13px;
      font-weight: 760;
    }

    .liax-guestbook-entry p {
      max-width: none;
      margin: 8px 0 0;
      white-space: pre-wrap;
    }

    .liax-tag-detail-card {
      display: grid;
      gap: 6px;
      max-width: 480px;
      margin: 24px 0;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface-muted);
      padding: 20px;
    }

    .liax-tag-detail-card span {
      color: var(--color-accent);
      font-size: 26px;
      font-weight: 900;
      line-height: 1;
    }

    .liax-tag-detail-card strong {
      font-size: 26px;
      line-height: 1.2;
    }

    .liax-tag-detail-card code {
      color: var(--color-text);
      overflow-wrap: anywhere;
    }

    .liax-section-back {
      color: var(--color-accent);
      font-weight: 760;
      text-decoration: underline;
      text-underline-offset: 0.18em;
    }

    @media (max-width: 900px) {
      .liax-guestbook-layout {
        grid-template-columns: 1fr;
      }

      .liax-guestbook-compose {
        max-width: 420px;
      }
    }

    @media (max-width: 620px) {
      .liax-article-card {
        grid-template-columns: 1fr;
      }

      .liax-article-meta {
        grid-column: 1;
        justify-self: start;
        white-space: normal;
      }

      .liax-guestbook-compose {
        max-width: none;
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
        scrollbar-width: none;
      }

      .liax-public-header::-webkit-scrollbar {
        display: none;
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

      .liax-section-card {
        width: calc(100% - 24px);
        margin: 18px auto 40px;
        padding: 18px 0;
      }

      .liax-section-card h1 {
        font-size: 36px;
      }

      .liax-section-description {
        font-size: 15px;
      }

      .liax-tag-grid,
      .liax-article-list,
      .liax-moment-list,
      .liax-guestbook-list,
      .liax-archive-timeline {
        margin-top: 18px;
      }

      .liax-tag-grid {
        grid-template-columns: 1fr;
      }

      .liax-archive-group a {
        grid-template-columns: 1fr;
        gap: 4px;
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
      <a class="liax-public-brand" href="/${prefix}">
        ${renderPublicLogo(settings)}
        <span>Liax Space</span>
      </a>
      <div class="liax-public-header__center">
        <nav class="liax-public-menu" aria-label="Primary">
          ${renderPublicMenuLinks(prefix, isZh)}
        </nav>
        ${switchHtml}
      </div>
      <div class="liax-public-header__tools">
        ${renderPublicSearchForm(prefix, isZh, "inline")}
        ${renderPublicMenuToggle(isZh)}
        ${renderPublicAvatar(avatarUrl)}
      </div>
    </header>
    ${renderPublicSidebar(prefix, isZh)}
    <main class="liax-section-card" data-section="${escapeHtml(section)}">
      <h1>${escapeHtml(label)}</h1>
      ${bodyHtml ?? `<p>${escapeHtml(description)}</p>`}
    </main>
  </div>
${renderFooterInjection(settings)}
${renderLanguageSwitchScript()}
</body>
</html>`;
}

function renderNotFoundBody(locale: ArticleLocale, prefix: LocalePrefix): string {
  const isZh = locale === "zh-CN";

  return `<p>${isZh ? "没有找到当前语言下的公开文章或页面。" : "No public article or page was found for the current language."}</p>
      <p>${isZh ? "公开站点不会自动切换到另一种语言。" : "The public site does not automatically fall back to another language."}</p>
      <p><a class="liax-section-back" href="/${prefix}/posts">${isZh ? "返回文章列表" : "Back to articles"}</a></p>`;
}

function sendPublicNotFound(
  response: Response,
  locale: ArticleLocale,
  prefix: LocalePrefix,
  settings: SiteSettings = {},
  avatarUrl: string | null = null
): void {
  response.status(404).type("html").send(renderPublicSectionPage(locale, prefix, "not-found", renderNotFoundBody(locale, prefix), settings, avatarUrl));
}

function renderForbiddenBody(locale: ArticleLocale, prefix: LocalePrefix, allowedRoles: readonly string[]): string {
  const isZh = locale === "zh-CN";
  const audience = formatArticleAudienceLabel(allowedRoles, locale);

  return `<p>${isZh ? "当前文章只允许指定身份访问。" : "This article is limited to selected identities."}</p>
      <p><strong>${escapeHtml(isZh ? "\u9700\u8981\u8eab\u4efd" : "Required identity")}:</strong> ${escapeHtml(audience)}</p>
      <p>${isZh ? "请使用有权限的账号访问，公开站点不会自动降级展示内容。" : "Use an account with access. The public site will not downgrade and reveal the content."}</p>
      <p><a class="liax-section-back" href="/${prefix}/posts">${isZh ? "返回文章列表" : "Back to articles"}</a></p>`;
}

function sendPublicForbidden(
  response: Response,
  locale: ArticleLocale,
  prefix: LocalePrefix,
  allowedRoles: readonly string[] = [],
  settings: SiteSettings = {},
  avatarUrl: string | null = null
): void {
  response.status(403).type("html").send(renderPublicSectionPage(locale, prefix, "not-found", renderForbiddenBody(locale, prefix, allowedRoles), settings, avatarUrl));
}

export class PublicArticleController {
  constructor(
    private readonly translationRepository = new ArticleTranslationRepository(),
    private readonly tagRepository = new TagRepository(),
    private readonly searchService = new SearchService(),
    private readonly momentRepository = new MomentRepository(),
    private readonly settingsRepository = new SettingsRepository(),
    private readonly guestbookRepository = new GuestbookRepository(),
    private readonly jwtService = new JwtService(),
    private readonly userRepository = new UserRepository(),
    private readonly mailService = new MailService()
  ) {}

  private async readPublicAvatarUrl(): Promise<string | null> {
    const userRepository = this.userRepository as Partial<UserRepository>;
    const settingsRepository = this.settingsRepository as Partial<SettingsRepository>;

    if (typeof userRepository.findAdminUser !== "function" || typeof settingsRepository.getUserPreferences !== "function") {
      return null;
    }

    const adminUser = await userRepository.findAdminUser();

    if (!adminUser) {
      return null;
    }

    const preferences = await settingsRepository.getUserPreferences(adminUser.id);
    const avatarUrl = preferences?.avatarPublicUrl ?? null;

    return avatarUrl && isPublicAssetUrl(avatarUrl) ? avatarUrl : null;
  }

  private async readPublicChrome(): Promise<{ avatarUrl: string | null; settings: SiteSettings }> {
    const settingsRepository = this.settingsRepository as Partial<SettingsRepository>;
    let settings: SiteSettings = {};

    if (typeof settingsRepository.getSiteSettings === "function") {
      try {
        settings = await this.settingsRepository.getSiteSettings();
      } catch {
        settings = {};
      }
    }

    try {
      return {
        avatarUrl: await this.readPublicAvatarUrl(),
        settings
      };
    } catch {
      return {
        avatarUrl: null,
        settings
      };
    }
  }

  private async readPublishedArticleChrome(prefix: LocalePrefix, translation: ArticleTranslation): Promise<PublishedArticleChrome> {
    const searchService = this.searchService as Partial<SearchService>;
    let articles: SearchResult[] = [];

    if (typeof searchService.searchPublic === "function") {
      try {
        articles = await this.searchService.searchPublic({ localePrefix: prefix, limit: 100 });
      } catch {
        articles = [];
      }
    }

    const currentIndex = articles.findIndex((article) => article.articleId === translation.articleId && article.slug === translation.slug);
    const currentArticle = currentIndex >= 0 ? articles[currentIndex] : null;

    return {
      allowedRoles: translation.allowedRoles,
      locale: translation.locale,
      newerArticle: currentIndex > 0 ? articles[currentIndex - 1] ?? null : null,
      olderArticle: currentIndex >= 0 ? articles[currentIndex + 1] ?? null : null,
      prefix,
      publishedAt: translation.publishedAt,
      tags: await this.readPublishedArticleTags(translation.articleId, translation.locale),
      visitCount: currentArticle?.visitCount ?? 0
    };
  }

  private async readPublishedArticleTags(articleId: number, locale: ArticleLocale): Promise<PublishedArticleTag[]> {
    const tagRepository = this.tagRepository as Partial<TagRepository>;

    if (typeof tagRepository.findByArticleId !== "function") {
      return [];
    }

    try {
      const tags = await this.tagRepository.findByArticleId(articleId);

      return tags.flatMap((tag) => {
        const translation = tag.translations.find((item) => item.locale === locale) ?? tag.translations[0];

        if (!translation?.name || !translation.slug) {
          return [];
        }

        return [{
          name: translation.name,
          slug: translation.slug
        }];
      });
    } catch {
      return [];
    }
  }

  getHome = async (request: Request, response: Response): Promise<void> => {
    const prefix = request.params.localePrefix;

    if (prefix !== "zh" && prefix !== "en") {
      throw notFoundError();
    }

    const { avatarUrl, settings } = await this.readPublicChrome();

    response.status(200).type("html").send(renderHomePage(localePrefixMap[prefix], prefix, settings, avatarUrl));
  };

  getSection = async (request: Request, response: Response): Promise<void> => {
    const prefix = request.params.localePrefix;
    const section = request.params.section;

    if (prefix !== "zh" && prefix !== "en") {
      throw notFoundError();
    }

    if (section === "account") {
      response.redirect(302, "/console");
      return;
    }

    if (!isPublicSection(section)) {
      throw notFoundError();
    }

    const locale = localePrefixMap[prefix];
    const { avatarUrl, settings } = await this.readPublicChrome();

    if (section === "tags") {
      const tags = await this.tagRepository.listTags();
      response.status(200).type("html").send(renderPublicSectionPage(locale, prefix, section, renderTagCards(locale, tags), settings, avatarUrl));
      return;
    }

    if (section === "posts") {
      const articles = await this.searchService.searchPublic({ localePrefix: prefix, limit: 100 });
      response.status(200).type("html").send(renderPublicSectionPage(locale, prefix, section, renderPostsBody(locale, prefix, articles), settings, avatarUrl));
      return;
    }

    if (section === "archives") {
      const articles = await this.searchService.searchPublic({ localePrefix: prefix, limit: 100 });
      response.status(200).type("html").send(renderPublicSectionPage(locale, prefix, section, renderArchiveBody(locale, prefix, articles), settings, avatarUrl));
      return;
    }

    if (section === "moments") {
      const moments = await this.momentRepository.listMoments({ locale, limit: 100, status: "published" });
      response.status(200).type("html").send(renderPublicSectionPage(locale, prefix, section, renderMomentsBody(locale, moments, {
        shouldRenderImage: isExistingPublicUploadImage
      }), settings, avatarUrl));
      return;
    }

    if (section === "guestbook") {
      const entries = await this.guestbookRepository.listPublicEntries({ locale, limit: 50 });
      response.status(200).type("html").send(renderPublicSectionPage(
        locale,
        prefix,
        section,
        renderGuestbookBody(locale, prefix, entries, { submitted: readGuestbookSubmitted(request.query.submitted) }),
        settings,
        avatarUrl
      ));
      return;
    }

    if (section === "contact") {
      response.status(200).type("html").send(renderPublicSectionPage(locale, prefix, section, renderContactBody(locale, settings), settings, avatarUrl));
      return;
    }

    response.status(200).type("html").send(renderPublicSectionPage(locale, prefix, section, undefined, settings, avatarUrl));
  };

  postGuestbook = async (request: Request, response: Response): Promise<void> => {
    const prefix = request.params.localePrefix;

    if (prefix !== "zh" && prefix !== "en") {
      throw notFoundError();
    }

    const locale = localePrefixMap[prefix];
    const parsed = parseGuestbookForm(request.body, locale);

    if (!parsed.input) {
      const entries = await this.guestbookRepository.listPublicEntries({ locale, limit: 50 });
      const { avatarUrl, settings } = await this.readPublicChrome();
      response.status(400).type("html").send(renderPublicSectionPage(
        locale,
        prefix,
        "guestbook",
        renderGuestbookBody(locale, prefix, entries, {
          errors: parsed.errors,
          values: parsed.values
        }),
        settings,
        avatarUrl
      ));
      return;
    }

    const entry = await this.guestbookRepository.createEntry(parsed.input);
    void this.mailService.sendGuestbookNotification(entry).catch((error: unknown) => {
      logger.warn("guestbook notification failed", {
        entryId: entry.id,
        message: error instanceof Error ? error.message : "Unknown mail notification error."
      });
    });
    response.redirect(303, `/${prefix}/guestbook?submitted=${entry.notifyOnly ? "private" : "public"}`);
  };

  getTagDetail = async (request: Request, response: Response): Promise<void> => {
    const prefix = request.params.localePrefix;

    if (prefix !== "zh" && prefix !== "en") {
      throw notFoundError();
    }

    const locale = localePrefixMap[prefix];
    const slug = request.params.slug;
    const translation = await this.tagRepository.findTranslationByLocaleAndSlug(locale, slug);

    if (!translation) {
      throw notFoundError();
    }

    const articles = await this.searchService.searchPublic({
      localePrefix: prefix,
      limit: 100,
      tag: translation.slug
    });
    const { avatarUrl, settings } = await this.readPublicChrome();

    response.status(200).type("html").send(
      renderPublicSectionPage(locale, prefix, "tags", renderTagDetailBody(locale, prefix, translation.name, translation.slug, articles), settings, avatarUrl)
    );
  };

  getArticle = async (request: Request, response: Response): Promise<void> => {
    const prefix = request.params.localePrefix;

    if (prefix !== "zh" && prefix !== "en") {
      throw notFoundError();
    }

    const locale = localePrefixMap[prefix];
    const slug = request.params.slug;
    const translation = await this.translationRepository.findPublicByLocaleAndSlug(locale, slug);
    const { avatarUrl, settings } = await this.readPublicChrome();

    if (!translation || !isPublishedTranslation(translation)) {
      sendPublicNotFound(response, locale, prefix, settings, avatarUrl);
      return;
    }

    if (!this.canViewTranslation(request, translation)) {
      sendPublicForbidden(response, locale, prefix, translation.allowedRoles, settings, avatarUrl);
      return;
    }

    const htmlPath = resolveRenderedHtmlPath(translation.currentHtmlPath);

    if (htmlPath === null) {
      logger.error("rendered html path is outside rendered storage", {
        articleId: translation.articleId,
        locale,
        slug,
        currentHtmlPath: translation.currentHtmlPath
      });
      sendPublicNotFound(response, locale, prefix, settings, avatarUrl);
      return;
    }

    try {
      const html = await readFile(htmlPath, "utf8");
      const articleChrome = await this.readPublishedArticleChrome(prefix, translation);
      response.status(200).type("html").send(patchPublishedArticleHtml(html, settings, avatarUrl, articleChrome));
    } catch (error) {
      if (isFileNotFound(error)) {
        logger.error("published rendered html file not found", {
          articleId: translation.articleId,
          locale,
          slug,
          currentHtmlPath: translation.currentHtmlPath,
          htmlPath
        });
        sendPublicNotFound(response, locale, prefix, settings, avatarUrl);
        return;
      }

      throw error;
    }
  };

  private canViewTranslation(request: Request, translation: ArticleTranslation): boolean {
    const auth = this.readOptionalAuth(request);

    return canRoleViewArticleAudience(auth?.role ?? null, translation.allowedRoles);
  }

  private readOptionalAuth(request: Request): AuthTokenPayload | null {
    const token = readBearerToken(request.headers.authorization);

    if (!token) {
      return null;
    }

    try {
      return this.jwtService.verifyToken(token);
    } catch {
      return null;
    }
  }
}
