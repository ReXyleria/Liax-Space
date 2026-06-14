import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { Request, Response } from "express";

import { ArticleTranslationRepository } from "../articles/ArticleTranslationRepository.js";
import type { ArticleLocale, ArticleTranslation } from "../articles/articles.types.js";
import { JwtService, type AuthTokenPayload } from "../auth/JwtService.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { logger } from "../common/logger.js";
import { storagePaths } from "../config/paths.js";
import { GuestbookRepository } from "../guestbook/GuestbookRepository.js";
import type { CreateGuestbookEntryInput, GuestbookEntry } from "../guestbook/guestbook.types.js";
import { MomentRepository } from "../moments/MomentRepository.js";
import type { Moment } from "../moments/moments.types.js";
import { renderLanguageSwitchScript } from "../renderer/TemplateRenderer.js";
import { SearchService, type SearchResult } from "../search/SearchService.js";
import { SettingsRepository } from "../settings/SettingsRepository.js";
import type { SiteSettings } from "../settings/settings.types.js";
import { TagRepository, type TagDetail } from "../tags/TagRepository.js";

type LocalePrefix = "zh" | "en";

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

  return `<div class="liax-public-sidebar-layer" aria-hidden="true" inert data-public-sidebar-layer>
      <button class="liax-public-sidebar-backdrop" type="button" aria-label="${closeLabel}" data-public-sidebar-close></button>
      <aside class="liax-public-sidebar" aria-label="${closeLabel}">
        ${renderPublicSearchForm(prefix, isZh, "sidebar")}
        <nav class="liax-public-sidebar-menu" aria-label="Primary">
          ${renderPublicMenuLinks(prefix, isZh)}
        </nav>
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

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function renderPublicLogo(settings: SiteSettings): string {
  const logoUrl = readLogoUrl(settings);
  const logoAlt = readStringSetting(settings, "site.logoAlt", "Liax Space");

  if (!logoUrl) {
    return `<span class="liax-public-logo" aria-hidden="true">LS</span>`;
  }

  return `<span class="liax-public-logo"><img alt="${escapeHtml(logoAlt)}" src="${escapeHtml(logoUrl)}"></span>`;
}

function includesCjk(value: string): boolean {
  return /[\u3400-\u9fff]/u.test(value);
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

function parseHomeContactItems(settings: SiteSettings, isZh: boolean): HomeContactItem[] {
  const localeKey = isZh ? "home.contactItems.zh-CN" : "home.contactItems.en-US";
  const defaultItems = isZh ? "邮箱:hello@example.com\nQQ:123456" : "Email:hello@example.com\nQQ:123456";
  const legacyItems = readStringSetting(settings, "home.contactItems", "");
  const legacyFallback = legacyItems && (isZh || !includesCjk(legacyItems)) ? legacyItems : defaultItems;
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
    .filter((item) => item.value.length > 0);
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

function renderHomeContactBox(settings: SiteSettings, isZh: boolean): string {
  const items = parseHomeContactItems(settings, isZh);

  return `<aside class="liax-home-contact" aria-label="${isZh ? "联系方式" : "Contact methods"}">
        ${items.map(renderHomeContactItem).join("\n        ")}
      </aside>`;
}

export function renderHomePage(locale: ArticleLocale, prefix: LocalePrefix, settings: SiteSettings): string {
  const isZh = locale === "zh-CN";
  const title = "Liax Space";
  const description = isZh ? "一个中英文双语言的温暖极简内容空间。" : "A warm minimal bilingual content space.";
  const switchHtml = renderHomeLanguageSwitch(prefix);
  const alternatePrefix = prefix === "zh" ? "en" : "zh";
  const alternateLocale = alternatePrefix === "zh" ? "zh-CN" : "en-US";
  const signature = readStringSetting(settings, "home.signature", "Timeless Silent Vigil");
  const brandInfo = readStringSetting(
    settings,
    "home.brandInfo",
    isZh ? "Liax Space · 温暖极简内容空间" : "Liax Space · Warm minimal content space"
  );
  const icpNumber = readStringSetting(settings, "home.icpNumber", isZh ? "备案号待配置" : "ICP pending");
  const icpUrl = readUrlSetting(settings, "home.icpUrl", "https://beian.miit.gov.cn");
  const contactBox = renderHomeContactBox(settings, isZh);

  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="/${prefix}">
  <link rel="alternate" hreflang="${alternateLocale}" href="/${alternatePrefix}">
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
      grid-template-rows: auto 1fr auto;
      width: 100%;
      margin: 0;
      padding: 0;
    }

    .liax-public-header,
    main,
    .liax-home-footer {
      animation: liax-page-enter 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    main {
      animation-delay: 70ms;
    }

    .liax-home-footer {
      animation-delay: 120ms;
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

    .liax-public-logo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .liax-public-header__center {
      display: grid;
      grid-template-columns: 44px minmax(0, auto);
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
      flex: 1 1 auto;
      flex-wrap: nowrap;
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
      width: auto;
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

    main {
      position: relative;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      align-items: center;
      gap: clamp(28px, 6vw, 72px);
      width: min(1440px, calc(100% - clamp(32px, 6vw, 96px)));
      margin: 0 auto;
      padding: clamp(64px, 10vh, 112px) 0 clamp(72px, 12vh, 132px);
    }

    .liax-home-author {
      display: inline-flex;
      width: max-content;
      align-items: center;
      gap: 10px;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface);
      padding: 8px 12px;
      font-size: 14px;
      font-weight: 760;
    }

    .liax-home-title {
      max-width: 820px;
      margin: 20px 0 0;
      font-size: clamp(56px, 8vw, 112px);
      line-height: 0.96;
      letter-spacing: 0;
    }

    .liax-home-contact {
      display: grid;
      gap: 12px;
      justify-self: end;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      box-shadow: 0 12px 38px rgba(20, 20, 19, 0.04);
      padding: 20px;
      width: 100%;
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

    .liax-home-footer {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      width: min(1440px, calc(100% - clamp(32px, 6vw, 96px)));
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
        overflow-x: auto;
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
      }

      .liax-home-contact {
        justify-self: start;
        width: 100%;
        box-sizing: border-box;
      }

      .liax-home-title {
        font-size: clamp(52px, 18vw, 96px);
      }

      .liax-home-footer {
        display: grid;
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

    @keyframes liax-language-wipe-ripple {
      0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0);
      }

      12% {
        opacity: 0.62;
        transform: translate(-50%, -50%) scale(0.14);
      }

      70% {
        opacity: 0.42;
        transform: translate(-50%, -50%) scale(0.78);
      }

      100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    @keyframes liax-language-wipe-ripple-soft {
      0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0);
      }

      18% {
        opacity: 0.34;
        transform: translate(-50%, -50%) scale(0.2);
      }

      100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(1.04);
      }
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

    @media (prefers-reduced-motion: reduce) {
      .liax-public-header,
      main,
      .liax-home-footer {
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
      <a class="liax-public-brand" href="/${prefix}">
        ${renderPublicLogo(settings)}
        <span>Liax Space</span>
      </a>
      <div class="liax-public-header__center">
        ${switchHtml}
        <nav class="liax-public-menu" aria-label="Primary">
          ${renderPublicMenuLinks(prefix, isZh)}
        </nav>
      </div>
      <div class="liax-public-header__tools">
        ${renderPublicSearchForm(prefix, isZh, "inline")}
        ${renderPublicMenuToggle(isZh)}
        <a class="liax-public-avatar" href="/console" aria-label="Console">A</a>
      </div>
    </header>
    ${renderPublicSidebar(prefix, isZh)}
    <main>
      <section>
        <div class="liax-home-author">${isZh ? "作者" : "Author"} · Liax</div>
        <h1 class="liax-home-title">${escapeHtml(signature)}</h1>
      </section>
      ${contactBox}
    </main>
    <footer class="liax-home-footer">
      <span>${escapeHtml(brandInfo)}</span>
      <a href="${escapeHtml(icpUrl)}" rel="noopener noreferrer" target="_blank">${escapeHtml(icpNumber)}</a>
    </footer>
  </div>
${renderLanguageSwitchScript()}
</body>
</html>`;
}

const publicSectionLabels = {
  account: { en: "Account", zh: "个人" },
  archives: { en: "Archives", zh: "归档" },
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

function renderTagCards(locale: ArticleLocale, tags: TagDetail[]): string {
  const localizedTags = tags.flatMap((tagDetail) => {
    const translation = tagDetail.translations.find((item) => item.locale === locale);

    return translation ? [{
      id: tagDetail.tag.id,
      name: translation.name,
      slug: translation.slug
    }] : [];
  });

  if (localizedTags.length === 0) {
    return `<p class="liax-section-empty">${locale === "zh-CN" ? "当前语言还没有标签。" : "No tags are available in this language yet."}</p>`;
  }

  return `<ul class="liax-tag-grid">
${localizedTags.map((tag) => `        <li><a href="/${locale === "zh-CN" ? "zh" : "en"}/tags/${escapeHtml(tag.slug)}"><span>#</span><strong>${escapeHtml(tag.name)}</strong><code>${escapeHtml(tag.slug)}</code></a></li>`).join("\n")}
      </ul>`;
}

function renderArticleCards(locale: ArticleLocale, prefix: LocalePrefix, articles: SearchResult[], emptyLabel: string): string {
  if (articles.length === 0) {
    return `<p class="liax-section-empty">${escapeHtml(emptyLabel)}</p>`;
  }

  return `<div class="liax-article-list">
${articles.map((article) => {
  const dateLabel = article.publishedAt ? new Date(article.publishedAt).toISOString().slice(0, 10) : "";
  const summary = article.summary ?? article.seoDescription ?? "";

  return `        <a class="liax-article-card" href="/${prefix}/posts/${encodeURIComponent(article.slug)}">
          <strong>${escapeHtml(article.title)}</strong>
          <time datetime="${escapeHtml(dateLabel)}">${escapeHtml(dateLabel)}</time>
          ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
        </a>`;
}).join("\n")}
      </div>`;
}

function renderArchiveBody(locale: ArticleLocale, prefix: LocalePrefix, articles: SearchResult[]): string {
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
          <h2>${escapeHtml(groupLabel)}</h2>
          <ol>
${groupArticles.map((article) => {
  const date = article.publishedAt ? new Date(article.publishedAt) : null;
  const dateLabel = date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : "";

  return `            <li>
              <a href="/${prefix}/posts/${encodeURIComponent(article.slug)}">
                <time datetime="${escapeHtml(dateLabel)}">${escapeHtml(dateLabel || (isZh ? "未注明" : "Undated"))}</time>
                <strong>${escapeHtml(article.title)}</strong>
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

export function renderMomentsBody(locale: ArticleLocale, moments: Moment[]): string {
  const isZh = locale === "zh-CN";

  if (moments.length === 0) {
    return `<p class="liax-section-empty">${isZh ? "当前语言还没有已发布瞬间。" : "No published moments are available in this language yet."}</p>`;
  }

  return `<p class="liax-section-description">${escapeHtml(isZh ? "短内容动态，只显示当前语言已发布内容。" : "Short updates. Only published content in the current language is shown.")}</p>
      <div class="liax-moment-list">
${moments.map((moment) => {
  const date = moment.publishedAt ?? moment.createdAt;
  const dateLabel = date.toISOString().slice(0, 10);

  const images = moment.images.length > 0
    ? `
          <div class="liax-moment-images">
${moment.images.map((image) => `            <img alt="" loading="lazy" src="${escapeHtml(image)}">`).join("\n")}
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

  return `        <article class="liax-guestbook-entry">
          <header>
            <strong>${escapeHtml(entry.authorName)}</strong>
            <time datetime="${escapeHtml(entry.createdAt.toISOString())}">${escapeHtml(dateLabel)}</time>
          </header>
          <p>${escapeHtml(entry.content)}</p>
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

  return `<p class="liax-section-description">${escapeHtml(isZh ? "邮箱不会在前台公开。公开留言会自动通过并展示；重要留言可选择只发送给站主。" : "Email addresses are never shown publicly. Public messages are displayed immediately; important notes can be sent only to the site owner.")}</p>
      ${renderGuestbookStatus(locale, state)}
      <form class="liax-guestbook-form" action="/${prefix}/guestbook" method="post">
        <label>
          <span>${isZh ? "昵称" : "Name"}</span>
          <input name="authorName" autocomplete="name" maxlength="80" required value="${escapeHtml(values.authorName ?? "")}">
        </label>
        <label>
          <span>${isZh ? "邮箱" : "Email"}</span>
          <input name="email" autocomplete="email" maxlength="255" type="email" value="${escapeHtml(values.email ?? "")}">
        </label>
        <label class="liax-guestbook-form__message">
          <span>${isZh ? "留言" : "Message"}</span>
          <textarea name="content" maxlength="1000" required rows="6">${escapeHtml(values.content ?? "")}</textarea>
        </label>
        <label class="liax-guestbook-form__notify">
          <input name="notifyOnly" type="checkbox" value="true"${notifyOnlyChecked}>
          <span>${isZh ? "仅发送给站主" : "Only send to the site owner"}</span>
        </label>
        <p class="liax-guestbook-form__help">${escapeHtml(isZh ? "勾选后这条留言不会在前台公开展示，会作为私密留言保存给站主查看。" : "When checked, this message is saved as private and will not appear on the public page.")}</p>
        <button type="submit">${isZh ? "提交留言" : "Submit message"}</button>
      </form>
      <h2 class="liax-guestbook-list-title">${isZh ? "公开留言" : "Public messages"}</h2>
      ${renderGuestbookEntries(locale, entries)}`;
}

function renderAccountBody(locale: ArticleLocale): string {
  const isZh = locale === "zh-CN";

  return `<div class="liax-account-card">
        <p class="liax-section-eyebrow">${escapeHtml(isZh ? "个人页面" : "Account")}</p>
        <h2>${escapeHtml(isZh ? "Liax Space 访问入口" : "Liax Space access")}</h2>
        <p>${escapeHtml(isZh ? "这里会承载个人偏好、登录状态和内容身份相关入口。当前版本先提供稳定跳转，避免头像点击落入无效页面。" : "This page is reserved for preferences, session state, and content identity. This version keeps the avatar target stable instead of sending users to a dead end.")}</p>
      </div>`;
}

export function renderPublicSectionPage(
  locale: ArticleLocale,
  prefix: LocalePrefix,
  section: RenderablePublicSection,
  bodyHtml?: string,
  settings: SiteSettings = {}
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
    .liax-section-card {
      animation: liax-page-enter 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .liax-section-card {
      animation-delay: 70ms;
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
      width: auto;
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

    .liax-public-logo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .liax-public-header__center,
    .liax-public-menu {
      flex-wrap: nowrap;
      justify-content: end;
      min-width: 0;
    }

    .liax-public-menu {
      flex: 1 1 auto;
    }

    .liax-public-header__center {
      display: grid;
      grid-template-columns: 44px minmax(0, auto);
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

    .liax-account-card {
      max-width: 640px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      padding: 24px;
    }

    .liax-account-card h2 {
      margin: 0 0 12px;
      font-size: clamp(24px, 4vw, 38px);
      line-height: 1.08;
      letter-spacing: 0;
    }

    .liax-account-card p:last-child {
      margin-bottom: 0;
    }

    .liax-section-card {
      box-sizing: border-box;
      width: min(1440px, calc(100% - clamp(32px, 6vw, 96px)));
      margin: 24px auto 48px;
      padding: 40px;
    }

    .liax-section-card h1 {
      margin: 0 0 14px;
      font-size: clamp(42px, 7vw, 88px);
      line-height: 1;
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
      background: var(--color-surface-muted);
      padding: 18px;
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
      grid-template-columns: auto minmax(0, 1fr);
      align-items: start;
      gap: 8px;
      min-height: 78px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      color: var(--color-text);
      font-weight: 760;
      padding: 14px;
      text-decoration: none;
    }

    .liax-tag-grid a:hover,
    .liax-tag-grid a:focus-visible {
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px rgba(217, 119, 87, 0.16);
      outline: 0;
    }

    .liax-tag-grid span {
      grid-row: span 2;
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

    .liax-tag-grid code {
      min-width: 0;
      overflow-wrap: anywhere;
      color: #6f6a5d;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 13px;
    }

    .liax-article-list {
      display: grid;
      gap: 14px;
      margin-top: 24px;
    }

    .liax-article-card {
      display: grid;
      gap: 8px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface-muted);
      color: var(--color-text);
      padding: 18px;
      text-decoration: none;
    }

    .liax-article-card strong {
      color: var(--color-text);
      font-size: 20px;
      font-weight: 800;
    }

    .liax-article-card:hover strong,
    .liax-article-card:focus-visible strong {
      color: var(--color-accent);
      text-decoration: underline;
      text-underline-offset: 0.18em;
    }

    .liax-article-card time,
    .liax-article-card p {
      margin: 0;
      color: var(--color-text);
    }

    .liax-article-card time {
      font-size: 13px;
      font-weight: 760;
    }

    .liax-archive-timeline {
      display: grid;
      gap: 26px;
      margin-top: 24px;
    }

    .liax-archive-group {
      display: grid;
      gap: 12px;
    }

    .liax-archive-group h2 {
      margin: 0;
      color: var(--color-accent);
      font-size: 18px;
    }

    .liax-archive-group ol {
      display: grid;
      gap: 0;
      margin: 0;
      padding: 0;
      list-style: none;
      border-top: 1px solid var(--color-border);
    }

    .liax-archive-group li {
      border-bottom: 1px solid var(--color-border);
    }

    .liax-archive-group a {
      display: grid;
      grid-template-columns: 116px minmax(0, 1fr);
      gap: 18px;
      align-items: baseline;
      color: var(--color-text);
      padding: 13px 0;
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
      font-size: 17px;
      overflow-wrap: anywhere;
    }

    .liax-moment-list {
      display: grid;
      gap: 14px;
      margin-top: 24px;
    }

    .liax-moment-card {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface-muted);
      padding: 18px;
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

    .liax-guestbook-form {
      display: grid;
      gap: 16px;
      max-width: 760px;
      margin-top: 24px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface-muted);
      padding: 20px;
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
      padding: 12px 14px;
    }

    .liax-guestbook-form textarea {
      min-height: 140px;
      resize: vertical;
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
      margin: -6px 0 0;
      max-width: none;
      color: #6f6a5d;
      font-size: 14px;
    }

    .liax-guestbook-form button {
      justify-self: start;
      border: 0;
      border-radius: 8px;
      background: var(--color-primary);
      color: var(--color-primary-text);
      cursor: pointer;
      font: inherit;
      font-weight: 800;
      padding: 12px 18px;
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
      margin: 34px 0 14px;
      font-size: 22px;
      line-height: 1.2;
      letter-spacing: 0;
    }

    .liax-guestbook-list {
      display: grid;
      gap: 14px;
      margin-top: 14px;
    }

    .liax-guestbook-entry {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface-muted);
      padding: 18px;
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
      margin: 0;
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

    @media (max-width: 860px) {
      .liax-public-header {
        grid-template-columns: max-content minmax(0, 1fr) max-content;
        height: 76px;
        min-height: 76px;
        gap: 10px;
        overflow-x: auto;
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
        padding: 24px;
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

    @keyframes liax-language-wipe-ripple {
      0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0);
      }

      12% {
        opacity: 0.62;
        transform: translate(-50%, -50%) scale(0.14);
      }

      70% {
        opacity: 0.42;
        transform: translate(-50%, -50%) scale(0.78);
      }

      100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    @keyframes liax-language-wipe-ripple-soft {
      0% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0);
      }

      18% {
        opacity: 0.34;
        transform: translate(-50%, -50%) scale(0.2);
      }

      100% {
        opacity: 0;
        transform: translate(-50%, -50%) scale(1.04);
      }
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

    @media (prefers-reduced-motion: reduce) {
      .liax-public-header,
      .liax-section-card {
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
      <a class="liax-public-brand" href="/${prefix}">
        ${renderPublicLogo(settings)}
        <span>Liax Space</span>
      </a>
      <div class="liax-public-header__center">
        ${switchHtml}
        <nav class="liax-public-menu" aria-label="Primary">
          ${renderPublicMenuLinks(prefix, isZh)}
        </nav>
      </div>
      <div class="liax-public-header__tools">
        ${renderPublicSearchForm(prefix, isZh, "inline")}
        ${renderPublicMenuToggle(isZh)}
        <a class="liax-public-avatar" href="/console" aria-label="Console">A</a>
      </div>
    </header>
    ${renderPublicSidebar(prefix, isZh)}
    <main class="liax-section-card">
      <h1>${escapeHtml(label)}</h1>
      ${bodyHtml ?? `<p>${escapeHtml(description)}</p>`}
    </main>
  </div>
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

function sendPublicNotFound(response: Response, locale: ArticleLocale, prefix: LocalePrefix): void {
  response.status(404).type("html").send(renderPublicSectionPage(locale, prefix, "not-found", renderNotFoundBody(locale, prefix)));
}

function renderForbiddenBody(locale: ArticleLocale, prefix: LocalePrefix): string {
  const isZh = locale === "zh-CN";

  return `<p>${isZh ? "当前文章只允许指定身份访问。" : "This article is limited to selected identities."}</p>
      <p>${isZh ? "请使用有权限的账号访问，公开站点不会自动降级展示内容。" : "Use an account with access. The public site will not downgrade and reveal the content."}</p>
      <p><a class="liax-section-back" href="/${prefix}/posts">${isZh ? "返回文章列表" : "Back to articles"}</a></p>`;
}

function sendPublicForbidden(response: Response, locale: ArticleLocale, prefix: LocalePrefix): void {
  response.status(403).type("html").send(renderPublicSectionPage(locale, prefix, "not-found", renderForbiddenBody(locale, prefix)));
}

export class PublicArticleController {
  constructor(
    private readonly translationRepository = new ArticleTranslationRepository(),
    private readonly tagRepository = new TagRepository(),
    private readonly searchService = new SearchService(),
    private readonly momentRepository = new MomentRepository(),
    private readonly settingsRepository = new SettingsRepository(),
    private readonly guestbookRepository = new GuestbookRepository(),
    private readonly jwtService = new JwtService()
  ) {}

  getHome = async (request: Request, response: Response): Promise<void> => {
    const prefix = request.params.localePrefix;

    if (prefix !== "zh" && prefix !== "en") {
      throw notFoundError();
    }

    const settings = await this.settingsRepository.getSiteSettings();

    response.status(200).type("html").send(renderHomePage(localePrefixMap[prefix], prefix, settings));
  };

  getSection = async (request: Request, response: Response): Promise<void> => {
    const prefix = request.params.localePrefix;
    const section = request.params.section;

    if ((prefix !== "zh" && prefix !== "en") || !isPublicSection(section)) {
      throw notFoundError();
    }

    const locale = localePrefixMap[prefix];
    const settings = await this.settingsRepository.getSiteSettings();

    if (section === "tags") {
      const tags = await this.tagRepository.listTags();
      response.status(200).type("html").send(renderPublicSectionPage(locale, prefix, section, renderTagCards(locale, tags), settings));
      return;
    }

    if (section === "posts") {
      const articles = await this.searchService.searchPublic({ localePrefix: prefix, limit: 100 });
      response.status(200).type("html").send(renderPublicSectionPage(locale, prefix, section, renderPostsBody(locale, prefix, articles), settings));
      return;
    }

    if (section === "archives") {
      const articles = await this.searchService.searchPublic({ localePrefix: prefix, limit: 100 });
      response.status(200).type("html").send(renderPublicSectionPage(locale, prefix, section, renderArchiveBody(locale, prefix, articles), settings));
      return;
    }

    if (section === "moments") {
      const moments = await this.momentRepository.listMoments({ locale, limit: 100, status: "published" });
      response.status(200).type("html").send(renderPublicSectionPage(locale, prefix, section, renderMomentsBody(locale, moments), settings));
      return;
    }

    if (section === "guestbook") {
      const entries = await this.guestbookRepository.listPublicEntries({ locale, limit: 50 });
      response.status(200).type("html").send(renderPublicSectionPage(
        locale,
        prefix,
        section,
        renderGuestbookBody(locale, prefix, entries, { submitted: readGuestbookSubmitted(request.query.submitted) }),
        settings
      ));
      return;
    }

    if (section === "account") {
      response.status(200).type("html").send(renderPublicSectionPage(locale, prefix, section, renderAccountBody(locale), settings));
      return;
    }

    response.status(200).type("html").send(renderPublicSectionPage(locale, prefix, section, undefined, settings));
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
      const settings = await this.settingsRepository.getSiteSettings();
      response.status(400).type("html").send(renderPublicSectionPage(
        locale,
        prefix,
        "guestbook",
        renderGuestbookBody(locale, prefix, entries, {
          errors: parsed.errors,
          values: parsed.values
        }),
        settings
      ));
      return;
    }

    const entry = await this.guestbookRepository.createEntry(parsed.input);
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
    const settings = await this.settingsRepository.getSiteSettings();

    response.status(200).type("html").send(
      renderPublicSectionPage(locale, prefix, "tags", renderTagDetailBody(locale, prefix, translation.name, translation.slug, articles), settings)
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

    if (!translation || !isPublishedTranslation(translation)) {
      sendPublicNotFound(response, locale, prefix);
      return;
    }

    if (!this.canViewTranslation(request, translation)) {
      sendPublicForbidden(response, locale, prefix);
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
      sendPublicNotFound(response, locale, prefix);
      return;
    }

    try {
      const html = await readFile(htmlPath, "utf8");
      response.status(200).type("html").send(html);
    } catch (error) {
      if (isFileNotFound(error)) {
        logger.error("published rendered html file not found", {
          articleId: translation.articleId,
          locale,
          slug,
          currentHtmlPath: translation.currentHtmlPath,
          htmlPath
        });
        sendPublicNotFound(response, locale, prefix);
        return;
      }

      throw error;
    }
  };

  private canViewTranslation(request: Request, translation: ArticleTranslation): boolean {
    if (translation.allowedRoles.length === 0) {
      return true;
    }

    const auth = this.readOptionalAuth(request);

    if (auth?.role === "admin") {
      return true;
    }

    if (auth !== null && translation.allowedRoles.includes(auth.role)) {
      return true;
    }

    return auth === null && translation.allowedRoles.includes("guest");
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
