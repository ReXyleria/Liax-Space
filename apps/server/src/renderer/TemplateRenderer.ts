import type { ArticleTocItem, TemplateRenderInput } from "./renderer.types.js";
import { formatArticleAudienceLabel } from "../articles/articleAudience.js";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderLanguageSwitchPlaceholder(input: TemplateRenderInput): string {
  const alternates = input.alternates ?? [];
  const targetLocale = input.locale === "zh-CN" ? "en-US" : "zh-CN";
  const targetAlternate = alternates.find((alternate) => alternate.hreflang === targetLocale);
  const label = targetLocale === "zh-CN" ? "切换到中文" : "Switch to English";
  const visibleLabel = targetLocale === "zh-CN" ? "中" : "EN";
  const links = targetAlternate
    ? `      <a class="liax-button liax-language-icon-button" aria-label="${escapeHtml(label)}" data-locale-target="${escapeHtml(targetAlternate.hreflang)}" href="${escapeHtml(targetAlternate.href)}">
        <span aria-hidden="true">${visibleLabel}</span>
      </a>`
    : `      <button class="liax-button liax-language-icon-button" data-locale-target="" disabled type="button">
        <span aria-hidden="true">${visibleLabel}</span>
      </button>`;

  return `    <nav class="liax-language-switch" aria-label="Language switch" data-language-switch-placeholder="true">
${links}
    </nav>`;
}

function renderPublicMenuLinks(localePrefix: string, locale: string): string {
  const isZh = locale === "zh-CN";

  return `<a href="/${localePrefix}">${isZh ? "首页" : "Home"}</a>
          <a href="/${localePrefix}/posts">${isZh ? "文章" : "Articles"}</a>
          <a href="/${localePrefix}/tags">${isZh ? "标签" : "Tags"}</a>
          <a href="/${localePrefix}/moments">${isZh ? "瞬间" : "Moments"}</a>
          <a href="/${localePrefix}/guestbook">${isZh ? "留言" : "Guestbook"}</a>
          <a href="/${localePrefix}/archives">${isZh ? "归档" : "Archives"}</a>`;
}

function renderPublicSearchForm(localePrefix: string, locale: string, variant: "inline" | "sidebar", query = ""): string {
  const label = locale === "zh-CN" ? "搜索" : "Search";

  return `<form class="liax-public-search-form liax-public-search-form--${variant}" action="/${localePrefix}/search" method="get" role="search">
          <input class="liax-public-search" aria-label="${label}" data-public-search-overlay-trigger name="q" type="search" placeholder="${label}" value="${escapeHtml(query)}">
        </form>`;
}

function renderPublicMenuToggle(locale: string): string {
  const label = locale === "zh-CN" ? "展开导航" : "Open navigation";

  return `<button class="liax-public-menu-toggle" type="button" aria-label="${label}" aria-expanded="false" data-public-sidebar-toggle>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </button>`;
}

function renderPublicSidebar(localePrefix: string, locale: string): string {
  const isZh = locale === "zh-CN";
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
        ${renderPublicSearchForm(localePrefix, locale, "sidebar")}
        <nav class="liax-public-sidebar-menu" aria-label="Primary">
          ${renderPublicMenuLinks(localePrefix, locale)}
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
      position: fixed !important;
      inset-block-start: 204px !important;
      inset-inline-end: clamp(18px, 3vw, 40px) !important;
      max-height: calc(100vh - 228px) !important;
    }

    .liax-reading-scrollbar {
      position: fixed;
      inset-block-start: 82px;
      inset-inline-end: 14px;
      z-index: 2147483000;
      width: 10px;
      height: calc(100vh - 104px);
      cursor: pointer;
      touch-action: none;
      opacity: 0.62;
    }

    .liax-reading-scrollbar__track,
    .liax-reading-scrollbar__thumb {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      border-radius: 999px;
    }

    .liax-reading-scrollbar__track {
      top: 0;
      width: 2px;
      height: 100%;
      background: rgb(20 20 19 / 10%);
    }

    .liax-reading-scrollbar__thumb {
      top: 0;
      width: 6px;
      min-height: 34px;
      background: rgb(95 122 80 / 50%);
      box-shadow: 0 6px 18px rgb(20 20 19 / 12%);
    }

    .liax-article-toc-toggle {
      display: none;
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
        position: fixed !important;
        inset-block-start: 84px !important;
        inset-inline-end: clamp(14px, 3vw, 24px) !important;
        width: min(300px, calc(100vw - 44px)) !important;
        max-height: 42vh !important;
      }
    }

    @media (max-width: 720px) {
      .liax-article-toc {
        inset-block-start: 82px !important;
        inset-inline-end: 0 !important;
        width: min(300px, calc(100vw - 52px)) !important;
        max-height: calc(100vh - 112px) !important;
        border-radius: 8px 0 0 8px !important;
        transform: translateX(calc(100% + 14px));
        transition: transform 180ms ease;
      }

      body.liax-toc-open .liax-article-toc {
        transform: translateX(0);
      }

      .liax-article-toc-toggle {
        position: fixed;
        inset-block-start: 132px;
        inset-inline-end: 0;
        z-index: 2147483001;
        display: flex;
        width: 34px;
        height: 72px;
        align-items: center;
        justify-content: center;
        border: 1px solid #c7c2b9;
        border-right: 0;
        border-radius: 8px 0 0 8px;
        background: #faf9f5;
        color: #3f3a33;
        box-shadow: 0 10px 24px rgb(20 20 19 / 10%);
        font: inherit;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0;
        writing-mode: vertical-rl;
      }

      .liax-reading-scrollbar {
        inset-inline-end: 6px;
        width: 8px;
        opacity: 0.42;
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
      background: rgb(250 249 245 / 96%);
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

    @media (max-width: 860px) {
      .liax-public-sidebar {
        width: min(340px, calc(100vw - 56px));
        padding: 18px;
      }
    }

`;
}

function renderArticleTocItem(item: ArticleTocItem): string {
  return `          <li data-level="${item.level}"><a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a></li>`;
}

function renderArticleToc(input: TemplateRenderInput): string {
  const tocItems = input.articleToc ?? [];

  if (tocItems.length === 0) {
    return "";
  }

  const label = input.locale === "zh-CN" ? "标题目录" : "Contents";

  return `      <nav class="liax-article-toc" aria-label="${escapeHtml(label)}">
        <strong>${escapeHtml(label)}</strong>
        <ol>
${tocItems.map(renderArticleTocItem).join("\n")}
        </ol>
      </nav>
`;
}

function renderArticleAudience(input: TemplateRenderInput): string {
  if (input.allowedRoles === undefined) {
    return "";
  }

  const isZh = input.locale === "zh-CN";
  const label = isZh ? "可见范围" : "Audience";
  const value = formatArticleAudienceLabel(input.allowedRoles, input.locale);

  return `        <p class="liax-article-audience"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></p>
`;
}

export function renderLanguageSwitchScript(): string {
  return `<script>
(() => {
  const buttonSelector = "[data-locale-target]";
  const sidebarLayerSelector = "[data-public-sidebar-layer]";
  const sidebarToggleSelector = "[data-public-sidebar-toggle]";
  const sidebarCloseSelector = "[data-public-sidebar-close]";
  const searchInputSelector = "[data-public-search-overlay-trigger]";
  const adminLocaleStorageKey = "liax.admin.locale";
  const localeCookieKey = "liax.locale";
  const publicLocaleStorageKey = "liax.public.locale";
  let isSwitching = false;
  let activeSearchOverlay = null;

  function removeDuplicateLanguageSwitches() {
    document.querySelectorAll(".liax-public-header .liax-language-switch[data-language-switch-placeholder]").forEach((node, index) => {
      if (index > 0) {
        node.remove();
      }
    });
  }

  function setSidebarOpen(layer, isOpen) {
    layer.classList.toggle("is-open", isOpen);
    layer.setAttribute("aria-hidden", isOpen ? "false" : "true");
    if (isOpen) {
      layer.removeAttribute("inert");
    } else {
      layer.setAttribute("inert", "");
    }
    document.querySelectorAll(sidebarToggleSelector).forEach((toggle) => {
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  function closeSidebars() {
    document.querySelectorAll(sidebarLayerSelector).forEach((layer) => setSidebarOpen(layer, false));
  }

  function currentPublicSection() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const section = parts[1] || "home";

    if (parts.length >= 3 && parts[1] === "posts") {
      return "posts";
    }

    return ["home", "posts", "tags", "moments", "guestbook", "archives", "search"].includes(section) ? section : "";
  }

  function updatePublicNavigationState() {
    const activeSection = currentPublicSection();
    document.querySelectorAll(".liax-public-menu a, .liax-public-sidebar-menu a").forEach((link) => {
      const href = link.getAttribute("href") || "";
      const targetParts = href.split("?")[0].split("/").filter(Boolean);
      const targetSection = targetParts[1] || "home";
      const isActive = activeSection !== "" && targetSection === activeSection;

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function writeLocalePreference(locale) {
    try {
      window.localStorage?.setItem(adminLocaleStorageKey, locale);
      window.localStorage?.setItem(publicLocaleStorageKey, locale);
    } catch {}
    document.cookie = localeCookieKey + "=" + encodeURIComponent(locale) + "; Path=/; Max-Age=31536000; SameSite=Lax";
  }

  function readAlternates() {
    const alternates = new Map();
    document.querySelectorAll('link[rel~="alternate"][hreflang][href]').forEach((link) => {
      if (link.hreflang) {
        alternates.set(link.hreflang, new URL(link.href, window.location.href).toString());
      }
    });
    return alternates;
  }

  function unavailableText() {
    return document.documentElement.lang.toLowerCase().startsWith("zh")
      ? "目标语言暂不可用。"
      : "This language is not available.";
  }

  function showUnavailableMessage() {
    let message = document.querySelector("[data-language-unavailable-message]");
    if (!message) {
      message = document.createElement("div");
      message.dataset.languageUnavailableMessage = "true";
      message.setAttribute("role", "status");
      message.setAttribute("aria-live", "polite");
      Object.assign(message.style, {
        background: "#141413",
        borderRadius: "8px",
        color: "#faf9f5",
        insetBlockStart: "16px",
        insetInlineEnd: "16px",
        padding: "10px 14px",
        position: "fixed",
        zIndex: "2147483647"
      });
      document.body.append(message);
    }
    message.textContent = unavailableText();
    window.setTimeout(() => message?.remove(), 2600);
  }

  async function fetchTargetDocument(url) {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: { Accept: "text/html" }
    });
    if (!response.ok) {
      throw new Error("Target page could not be loaded.");
    }
    return new DOMParser().parseFromString(await response.text(), "text/html");
  }

  function readMain(source) {
    const main = source.querySelector("main");
    if (!main) {
      throw new Error("Target main content was not found.");
    }
    return main;
  }

  function updateHead(targetDocument) {
    document.title = targetDocument.title;
    document.documentElement.lang = targetDocument.documentElement.lang;
    document.querySelectorAll('link[rel~="alternate"][hreflang], link[rel="canonical"]').forEach((node) => node.remove());
    targetDocument.querySelectorAll('link[rel~="alternate"][hreflang], link[rel="canonical"]').forEach((node) => {
      document.head.append(node.cloneNode(true));
    });
    const currentDescription = document.querySelector('meta[name="description"]');
    const targetDescription = targetDocument.querySelector('meta[name="description"]');
    if (currentDescription && targetDescription) {
      currentDescription.content = targetDescription.content;
    }
  }

  function replaceFromTarget(targetDocument) {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const currentHeader = document.querySelector(".liax-public-header");
    const targetHeader = targetDocument.querySelector(".liax-public-header");
    const currentMain = document.querySelector("main");
    const targetMain = readMain(targetDocument);
    const currentFooter = document.querySelector("footer");
    const targetFooter = targetDocument.querySelector("footer");
    const currentSidebar = document.querySelector(sidebarLayerSelector);
    const targetSidebar = targetDocument.querySelector(sidebarLayerSelector);
    if (currentHeader && targetHeader) {
      const nextHeader = targetHeader.cloneNode(true);
      nextHeader.style.animation = "none";
      nextHeader.style.transform = "none";
      currentHeader.replaceWith(nextHeader);
    }
    if (!currentMain) {
      throw new Error("Current main content was not found.");
    }
    currentMain.replaceWith(targetMain.cloneNode(true));
    if (currentFooter && targetFooter) {
      currentFooter.replaceWith(targetFooter.cloneNode(true));
    }
    if (currentSidebar && targetSidebar) {
      currentSidebar.replaceWith(targetSidebar.cloneNode(true));
    }
    updateHead(targetDocument);
    removeDuplicateLanguageSwitches();
    updatePublicNavigationState();
    enhanceArticlePage();
    attachGuestbookValidation();
    window.scrollTo({ left: scrollX, top: scrollY });
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function swapTargetDocument(targetDocument) {
    const currentMain = document.querySelector("main");
    const currentFooter = document.querySelector("footer");

    if (!shouldReduceMotion()) {
      [currentMain, currentFooter].forEach((node) => {
        if (!node) {
          return;
        }
        node.style.transition = "opacity 80ms ease";
        node.style.opacity = "0";
      });
      await sleep(80);
    }

    replaceFromTarget(targetDocument);

    if (shouldReduceMotion()) {
      return;
    }

    const nextMain = document.querySelector("main");
    const nextFooter = document.querySelector("footer");
    [nextMain, nextFooter].forEach((node) => {
      if (!node) {
        return;
      }
      node.style.transition = "none";
      node.style.opacity = "0";
    });
    requestAnimationFrame(() => {
      [nextMain, nextFooter].forEach((node) => {
        if (!node) {
          return;
        }
        node.style.transition = "opacity 120ms ease";
        node.style.opacity = "1";
        window.setTimeout(() => {
          node.style.transition = "";
          node.style.opacity = "";
        }, 140);
      });
    });
  }

  function searchPlaceholder() {
    return document.documentElement.lang.toLowerCase().startsWith("zh") ? "搜索" : "Search";
  }

  function shouldReduceMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }

  function closeSearchOverlay() {
    if (!activeSearchOverlay) {
      return;
    }

    const overlay = activeSearchOverlay;
    activeSearchOverlay = null;
    document.querySelectorAll(searchInputSelector).forEach((input) => {
      input.removeAttribute("aria-hidden");
      input.removeAttribute("inert");
      const originalTabIndex = input.dataset.publicSearchOriginalTabindex;
      if (originalTabIndex) {
        input.setAttribute("tabindex", originalTabIndex);
      } else {
        input.removeAttribute("tabindex");
      }
      delete input.dataset.publicSearchOriginalTabindex;
    });
    document.querySelectorAll("[data-public-search-form-hidden]").forEach((form) => {
      form.style.opacity = "";
      form.style.pointerEvents = "";
      form.removeAttribute("data-public-search-form-hidden");
    });

    if (shouldReduceMotion()) {
      overlay.remove();
      return;
    }

    overlay.style.opacity = "0";
    window.setTimeout(() => overlay.remove(), 180);
  }

  function openSearchOverlay(sourceInput) {
    if (activeSearchOverlay) {
      return;
    }

    const sourceForm = sourceInput.form;
    const targetUrl = sourceForm?.getAttribute("action") || window.location.pathname;
    const overlay = document.createElement("div");
    const backdrop = document.createElement("button");
    const panel = document.createElement("form");
    const input = document.createElement("input");
    const hint = document.createElement("p");
    const label = searchPlaceholder();

    document.querySelectorAll(searchInputSelector).forEach((input) => {
      input.setAttribute("aria-hidden", "true");
      input.dataset.publicSearchOriginalTabindex = input.getAttribute("tabindex") || "";
      input.setAttribute("tabindex", "-1");
      input.setAttribute("inert", "");
      const form = input.closest(".liax-public-search-form");
      if (form) {
        form.dataset.publicSearchFormHidden = "true";
        form.style.opacity = "0";
        form.style.pointerEvents = "none";
      }
    });

    overlay.dataset.publicSearchOverlay = "true";
    Object.assign(overlay.style, {
      alignItems: "start",
      boxSizing: "border-box",
      display: "grid",
      inset: "0",
      justifyItems: "center",
      opacity: "0",
      padding: "clamp(72px, 16vh, 150px) 24px 24px",
      position: "fixed",
      transition: "opacity 220ms ease",
      zIndex: "2147483645"
    });

    backdrop.dataset.publicSearchBackdrop = "true";
    backdrop.setAttribute("aria-label", label);
    Object.assign(backdrop.style, {
      backdropFilter: "blur(2px)",
      background: "rgba(250, 249, 245, 0.42)",
      border: "0",
      cursor: "default",
      inset: "0",
      padding: "0",
      position: "absolute"
    });

    panel.dataset.publicSearchPanel = "true";
    panel.setAttribute("role", "search");
    Object.assign(panel.style, {
      background: "#ffffff",
      border: "1px solid rgba(199, 194, 185, 0.78)",
      borderRadius: "8px",
      boxShadow: "0 18px 46px rgba(20, 20, 19, 0.13)",
      boxSizing: "border-box",
      display: "grid",
      gap: "8px",
      marginTop: "0",
      opacity: shouldReduceMotion() ? "1" : "0",
      padding: "14px",
      position: "relative",
      transform: "none",
      transition: "opacity 140ms ease",
      width: "min(840px, calc(100vw - 40px))"
    });

    input.dataset.publicSearchOverlayInput = "true";
    input.name = "q";
    input.type = "search";
    input.value = sourceInput.value || "";
    input.placeholder = label;
    input.setAttribute("aria-label", label);
    Object.assign(input.style, {
      background: "#fffdfa",
      border: "1px solid #c6d0bf",
      borderRadius: "999px",
      boxSizing: "border-box",
      color: "#141413",
      font: "inherit",
      fontSize: "20px",
      outline: "0",
      padding: "15px 18px",
      transition: "border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease",
      width: "100%"
    });
    input.addEventListener("focus", () => {
      input.style.background = "#ffffff";
      input.style.borderColor = "#5f7a50";
      input.style.boxShadow = "0 0 0 4px rgba(95, 122, 80, 0.14)";
    });
    input.addEventListener("blur", () => {
      input.style.background = "#fffdfa";
      input.style.borderColor = "#c6d0bf";
      input.style.boxShadow = "none";
    });

    hint.textContent = document.documentElement.lang.toLowerCase().startsWith("zh") ? "输入关键词后按 Enter 搜索，Esc 关闭。" : "Type keywords and press Enter. Esc closes search.";
    Object.assign(hint.style, {
      color: "rgba(20, 20, 19, 0.68)",
      fontSize: "13px",
      margin: "0",
      paddingInline: "4px"
    });

    panel.addEventListener("submit", (event) => {
      event.preventDefault();
      const url = new URL(targetUrl, window.location.href);
      const keyword = input.value.trim();
      if (keyword) {
        url.searchParams.set("q", keyword);
      } else {
        url.searchParams.delete("q");
      }
      window.location.href = url.toString();
    });
    backdrop.addEventListener("click", closeSearchOverlay);
    overlay.append(backdrop, panel);
    panel.append(input, hint);
    document.body.append(overlay);
    activeSearchOverlay = overlay;
    sourceInput.blur();
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      panel.style.opacity = "1";
      panel.style.transform = "none";
    });
    window.setTimeout(() => input.focus(), shouldReduceMotion() ? 0 : 180);
  }

  function guestbookText(key) {
    const isZh = document.documentElement.lang.toLowerCase().startsWith("zh");
    const text = {
      validation: isZh ? "请补全必填内容后再提交。" : "Complete the required fields before submitting.",
      message: isZh ? "留言内容不能为空。" : "Message is required.",
      email: isZh ? "邮箱格式不正确。" : "Enter a valid email address.",
      name: isZh ? "昵称不能为空。" : "Name is required."
    };
    return text[key] || key;
  }

  function ensureGuestbookValidationMessage(form) {
    let message = form.querySelector("[data-guestbook-validation-message]");
    if (!message) {
      message = document.createElement("p");
      message.className = "liax-guestbook-form__validation";
      message.dataset.guestbookValidationMessage = "true";
      message.setAttribute("role", "alert");
      message.setAttribute("aria-live", "polite");
      form.append(message);
    }
    return message;
  }

  function showGuestbookValidation(form, field) {
    const message = ensureGuestbookValidationMessage(form);
    field?.setAttribute("aria-invalid", "true");
    const fieldName = field?.getAttribute("name");
    message.textContent = guestbookText(fieldName === "content" ? "message" : fieldName === "authorName" ? "name" : fieldName === "email" ? "email" : "validation");
    form.dataset.validationState = "error";
  }

  function attachGuestbookValidation() {
    document.querySelectorAll(".liax-guestbook-form").forEach((form) => {
      if (form.dataset.guestbookValidationAttached) {
        return;
      }
      form.dataset.guestbookValidationAttached = "true";
      form.addEventListener("invalid", (event) => {
        const field = event.target instanceof HTMLElement ? event.target : null;
        if (!field || !form.contains(field)) {
          return;
        }
        event.preventDefault();
        showGuestbookValidation(form, field);
        window.setTimeout(() => field.focus(), 0);
      }, true);
      form.addEventListener("input", (event) => {
        const field = event.target instanceof HTMLElement ? event.target : null;
        if (field) {
          field.removeAttribute("aria-invalid");
        }
        const fields = Array.from(form.elements).filter((element) => (
          element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
        ));
        const isValid = fields.every((element) => !element.willValidate || element.validity.valid);
        if (isValid) {
          form.removeAttribute("data-validation-state");
          const message = form.querySelector("[data-guestbook-validation-message]");
          if (message) {
            message.textContent = "";
          }
        }
      });
      form.addEventListener("submit", (event) => {
        if (form.checkValidity()) {
          return;
        }
        event.preventDefault();
        const firstInvalid = form.querySelector(":invalid");
        showGuestbookValidation(form, firstInvalid instanceof HTMLElement ? firstInvalid : null);
      });
    });
  }

  function articleUiText(key) {
    const isZh = document.documentElement.lang.toLowerCase().startsWith("zh");
    const text = {
      toc: isZh ? "标题目录" : "Contents",
      copy: isZh ? "复制" : "Copy",
      copied: isZh ? "已复制" : "Copied"
    };
    return text[key] || key;
  }

  function headingSlug(text, index) {
    const normalized = text.trim().toLowerCase().replace(/[^\\p{L}\\p{N}]+/gu, "-").replace(/^-+|-+$/gu, "");
    return normalized || "section-" + (index + 1);
  }

  function setupReadingScrollbar() {
    if (document.querySelector(".liax-reading-scrollbar")) {
      return;
    }
    const scrollbar = document.createElement("div");
    const track = document.createElement("span");
    const thumb = document.createElement("span");
    scrollbar.className = "liax-reading-scrollbar";
    track.className = "liax-reading-scrollbar__track";
    thumb.className = "liax-reading-scrollbar__thumb";
    scrollbar.setAttribute("aria-label", "Reading progress");
    scrollbar.setAttribute("role", "scrollbar");
    scrollbar.append(track, thumb);
    document.body.append(scrollbar);

    function metrics() {
      const root = document.documentElement;
      const height = Math.max(root.scrollHeight, document.body.scrollHeight);
      const viewport = window.innerHeight;
      const max = Math.max(1, height - viewport);
      const rect = scrollbar.getBoundingClientRect();
      const thumbHeight = Math.max(34, Math.min(rect.height, rect.height * (viewport / Math.max(height, 1))));
      const travel = Math.max(1, rect.height - thumbHeight);

      return { max, rect, thumbHeight, travel };
    }

    function update() {
      const current = metrics();
      const progress = Math.min(1, Math.max(0, window.scrollY / current.max));
      thumb.style.height = current.thumbHeight + "px";
      thumb.style.transform = "translate(-50%, " + (progress * current.travel) + "px)";
    }

    function scrollFromPointer(clientY) {
      const current = metrics();
      const value = Math.min(1, Math.max(0, (clientY - current.rect.top - current.thumbHeight / 2) / current.travel));
      window.scrollTo({ top: current.max * value, behavior: "auto" });
    }

    let isDragging = false;
    scrollbar.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      isDragging = true;
      scrollbar.setPointerCapture?.(event.pointerId);
      scrollFromPointer(event.clientY);
    });
    scrollbar.addEventListener("pointermove", (event) => {
      if (!isDragging) {
        return;
      }
      event.preventDefault();
      scrollFromPointer(event.clientY);
    });
    const stopDragging = () => {
      isDragging = false;
    };
    scrollbar.addEventListener("pointerup", stopDragging);
    scrollbar.addEventListener("pointercancel", stopDragging);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  function setupMobileArticleToc(toc) {
    if (!toc) {
      return;
    }
    if (!toc.id) {
      toc.id = "liax-article-toc";
    }
    const mobileQuery = window.matchMedia("(max-width: 720px)");
    let toggle = document.querySelector(".liax-article-toc-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.className = "liax-article-toc-toggle";
      toggle.type = "button";
      toggle.textContent = document.documentElement.lang.toLowerCase().startsWith("zh") ? "目录" : "Contents";
      toggle.setAttribute("aria-controls", toc.id);
      document.body.append(toggle);
    }

    const applyState = () => {
      const isMobile = mobileQuery.matches;
      const isOpen = document.body.classList.contains("liax-toc-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");

      if (isMobile) {
        toc.style.position = "fixed";
        toc.style.insetBlockStart = "82px";
        toc.style.insetInlineEnd = "0";
        toc.style.width = "min(300px, calc(100vw - 52px))";
        toc.style.maxHeight = "calc(100vh - 112px)";
        toc.style.borderRadius = "8px 0 0 8px";
        toc.style.transform = isOpen ? "translateX(0)" : "translateX(calc(100% + 14px))";
        toc.style.transition = "transform 180ms ease";

        toggle.style.position = "fixed";
        toggle.style.insetBlockStart = "132px";
        toggle.style.insetInlineEnd = "0";
        toggle.style.zIndex = "2147483001";
        toggle.style.display = "flex";
        toggle.style.width = "34px";
        toggle.style.height = "72px";
        toggle.style.alignItems = "center";
        toggle.style.justifyContent = "center";
        toggle.style.border = "1px solid #c7c2b9";
        toggle.style.borderRight = "0";
        toggle.style.borderRadius = "8px 0 0 8px";
        toggle.style.background = "#faf9f5";
        toggle.style.color = "#3f3a33";
        toggle.style.boxShadow = "0 10px 24px rgb(20 20 19 / 10%)";
        toggle.style.font = "inherit";
        toggle.style.fontSize = "13px";
        toggle.style.fontWeight = "800";
        toggle.style.letterSpacing = "0";
        toggle.style.writingMode = "vertical-rl";
        return;
      }

      document.body.classList.remove("liax-toc-open");
      toggle.style.display = "none";
      toc.style.position = "";
      toc.style.insetBlockStart = "";
      toc.style.insetInlineEnd = "";
      toc.style.width = "";
      toc.style.maxHeight = "";
      toc.style.borderRadius = "";
      toc.style.transform = "";
      toc.style.transition = "";
    };

    if (toggle.dataset.liaxReady !== "true") {
      toggle.dataset.liaxReady = "true";
      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        document.body.classList.toggle("liax-toc-open");
        applyState();
      });
    }

    if (toc.dataset.liaxCloseReady !== "true") {
      toc.dataset.liaxCloseReady = "true";
      toc.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", () => {
          document.body.classList.remove("liax-toc-open");
          applyState();
        });
      });
    }

    if (document.body.dataset.liaxTocOutsideReady !== "true") {
      document.body.dataset.liaxTocOutsideReady = "true";
      document.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target || target.closest(".liax-article-toc") || target.closest(".liax-article-toc-toggle")) {
          return;
        }
        document.body.classList.remove("liax-toc-open");
        applyState();
      });
      window.addEventListener("resize", () => {
        if (!window.matchMedia("(max-width: 720px)").matches) {
          document.body.classList.remove("liax-toc-open");
        }
        applyState();
      });
    }
    applyState();
  }

  function enhanceArticlePage() {
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
      nav.setAttribute("aria-label", articleUiText("toc"));
      title.textContent = articleUiText("toc");
      headings.forEach((heading, index) => {
        const baseId = heading.id || headingSlug(heading.textContent || "", index);
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
      document.body.append(nav);
    }

    const articleToc = document.querySelector(".liax-article-toc");
    if (articleToc && articleToc.parentElement !== document.body) {
      document.body.append(articleToc);
    }
    setupMobileArticleToc(articleToc);
    setupReadingScrollbar();

    body.querySelectorAll("pre").forEach((pre) => {
      if (pre.querySelector(".liax-code-copy")) {
        return;
      }
      pre.classList.add("liax-code-frame");
      const button = document.createElement("button");
      button.className = "liax-code-copy";
      button.type = "button";
      button.textContent = articleUiText("copy");
      button.addEventListener("click", async () => {
        const code = pre.querySelector("code")?.textContent || pre.textContent || "";
        try {
          await navigator.clipboard?.writeText(code);
          button.textContent = articleUiText("copied");
          window.setTimeout(() => {
            button.textContent = articleUiText("copy");
          }, 1400);
        } catch {}
      });
      pre.append(button);
    });
  }

  document.addEventListener("click", (event) => {
    const input = event.target instanceof Element ? event.target.closest(searchInputSelector) : null;
    if (!input) {
      return;
    }
    event.preventDefault();
    openSearchOverlay(input);
  });

  document.addEventListener("focusin", (event) => {
    const input = event.target instanceof Element ? event.target.closest(searchInputSelector) : null;
    if (input) {
      openSearchOverlay(input);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeSearchOverlay) {
      event.preventDefault();
      closeSearchOverlay();
    }
    if (event.key === "Escape") {
      closeSidebars();
    }
  });

  document.addEventListener("click", (event) => {
    const toggle = event.target instanceof Element ? event.target.closest(sidebarToggleSelector) : null;
    if (toggle) {
      event.preventDefault();
      const layer = document.querySelector(sidebarLayerSelector);
      if (layer) {
        setSidebarOpen(layer, layer.getAttribute("aria-hidden") !== "false");
      }
      return;
    }

    const close = event.target instanceof Element ? event.target.closest(sidebarCloseSelector) : null;
    if (close) {
      event.preventDefault();
      closeSidebars();
    }
  });

  document.addEventListener("click", async (event) => {
    const element = event.target instanceof Element ? event.target.closest(buttonSelector) : null;
    const locale = element?.dataset.localeTarget?.trim();
    if (!element || !locale) {
      return;
    }
    event.preventDefault();
    const targetUrl = readAlternates().get(locale);
    if (!targetUrl) {
      showUnavailableMessage();
      return;
    }
    if (targetUrl === window.location.href || isSwitching) {
      return;
    }
    let targetDocument;
    try {
      targetDocument = await fetchTargetDocument(targetUrl);
      readMain(targetDocument);
    } catch {
      window.location.href = targetUrl;
      return;
    }
    isSwitching = true;
    try {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        replaceFromTarget(targetDocument);
        history.pushState({}, "", targetUrl);
        writeLocalePreference(locale);
        return;
      }
      await swapTargetDocument(targetDocument);
      history.pushState({}, "", targetUrl);
      writeLocalePreference(locale);
    } catch {
      window.location.href = targetUrl;
    } finally {
      isSwitching = false;
    }
  });

  removeDuplicateLanguageSwitches();
  updatePublicNavigationState();
  enhanceArticlePage();
  attachGuestbookValidation();
})();
</script>`;
}

export class TemplateRenderer {
  render(input: TemplateRenderInput): string {
    const title = escapeHtml(input.title ?? "Liax Space");
    const locale = escapeHtml(input.locale ?? "en-US");
    const localePrefix = input.locale === "zh-CN" ? "zh" : "en";
    const templateVersion = escapeHtml(input.templateVersion);
    const description = input.description?.trim() ?? "";
    const languageSwitchHtml = renderLanguageSwitchPlaceholder(input);
    const metadata = [
      `<link rel="icon" href="/favicon.svg">`,
      `<meta name="description" content="${escapeHtml(description)}">`,
      input.canonicalUrl ? `<link rel="canonical" href="${escapeHtml(input.canonicalUrl)}">` : null,
      ...(input.alternates ?? []).map((alternate) => {
        return `<link rel="alternate" hreflang="${escapeHtml(alternate.hreflang)}" href="${escapeHtml(alternate.href)}">`;
      })
    ]
      .filter((line): line is string => line !== null)
      .map((line) => `  ${line}`)
      .join("\n");
    const metadataHtml = metadata.length > 0 ? `\n${metadata}` : "";

    return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="template-version" content="${templateVersion}">${metadataHtml}
  <title>${title}</title>
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

    html {
      background: var(--color-page);
      color: var(--color-text);
      scrollbar-width: none;
    }

    body {
      margin: 0;
      background: var(--color-page);
      color: var(--color-text);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.7;
      scrollbar-width: none;
    }

    html::-webkit-scrollbar,
    body::-webkit-scrollbar {
      display: none;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    .liax-public-shell {
      box-sizing: border-box;
      display: grid;
      min-height: 100vh;
      grid-template-rows: auto 1fr;
      min-width: 0;
      max-width: 100%;
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
      min-width: 0;
      max-width: 100vw;
      width: 100%;
      height: 76px;
      min-height: 76px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
      margin: 0;
      padding: 12px clamp(18px, 3vw, 40px);
    }

    .liax-public-brand {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--color-text);
      font-size: 18px;
      font-weight: 760;
      text-decoration: none;
      white-space: nowrap;
    }

    .liax-public-logo {
      display: inline-grid;
      width: 34px;
      height: 34px;
      place-items: center;
      border: 1px solid var(--color-border);
      border-radius: 999px;
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

    .liax-public-header__center,
    .liax-public-header__tools,
    .liax-public-menu {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .liax-public-header__center {
      display: grid;
      grid-template-columns: minmax(0, auto) 44px;
      justify-content: end;
      align-items: center;
      gap: 10px;
    }

    .liax-public-menu {
      display: grid;
      grid-template-columns: repeat(6, 86px);
      justify-content: flex-end;
      min-width: 0;
      position: relative;
      z-index: 1;
    }

    .liax-public-menu a {
      color: var(--color-text);
      flex: 0 0 auto;
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      display: inline-flex;
      justify-content: center;
      width: 86px;
      padding: 6px 7px;
      white-space: nowrap;
    }

    .liax-public-menu a:hover,
    .liax-public-menu a:focus-visible {
      color: var(--color-accent);
      text-decoration: underline;
    }

    .liax-language-switch {
      display: flex;
      flex: 0 0 auto;
      flex-wrap: nowrap;
      gap: 6px;
      justify-content: center;
      position: relative;
      z-index: 2;
      width: 44px;
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
      min-width: 140px;
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
      width: 100vw;
      max-width: 100vw;
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
      width: 100vw;
      max-width: 100vw;
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
      display: inline-grid;
      width: 38px;
      height: 38px;
      place-items: center;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface-muted);
      color: var(--color-text);
      font-weight: 800;
      text-decoration: none;
    }

    .liax-article-card {
      box-sizing: border-box;
      min-width: 0;
      max-width: 100vw;
      width: 100%;
      margin: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--color-text);
      overflow-x: clip;
      padding: clamp(22px, 3.4vw, 48px);
      padding-inline-end: clamp(280px, 22vw, 360px);
    }

    .liax-article-header {
      min-width: 0;
      width: min(980px, 100%);
      max-width: 100%;
      border-bottom: 1px solid var(--color-border);
      margin: 0 0 clamp(24px, 4vw, 44px);
      padding: 0 0 clamp(18px, 3vw, 30px);
    }

    .liax-article-header h1 {
      font-size: clamp(34px, 5vw, 74px);
      letter-spacing: 0;
      line-height: 1.04;
      margin: 0;
    }

    .liax-article-body h2,
    .liax-article-body h3,
    .liax-article-body h4 {
      scroll-margin-top: 96px;
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
      position: fixed;
      inset-block-start: 96px;
      inset-inline-end: clamp(18px, 3vw, 40px);
      z-index: 22;
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      box-sizing: border-box;
      width: clamp(220px, 20vw, 300px);
      max-height: 92px;
      margin: 0;
      overflow-y: auto;
      border: 1px solid rgb(199 194 185 / 76%);
      border-radius: 8px;
      background: rgb(250 249 245 / 92%);
      box-shadow: 0 14px 36px rgba(20, 20, 19, 0.09);
      padding: 11px 12px;
      backdrop-filter: blur(10px);
    }

    .liax-article-tags a {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      border: 1px solid var(--color-border);
      border-radius: 999px;
      background: var(--color-surface-muted);
      color: var(--color-text);
      font-size: 12px;
      font-weight: 760;
      line-height: 1;
      padding: 6px 9px;
      text-decoration: none;
    }

    .liax-article-tags a:hover,
    .liax-article-tags a:focus-visible {
      border-color: var(--color-accent);
      color: var(--color-accent);
      outline: 0;
    }

    .liax-article-footer {
      width: min(980px, 100%);
      margin-top: clamp(30px, 5vw, 56px);
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
      inset-block-start: 204px;
      inset-inline-end: clamp(18px, 3vw, 40px);
      z-index: 20;
      display: grid;
      gap: 10px;
      min-width: 0;
      width: clamp(220px, 20vw, 300px);
      max-height: calc(100vh - 228px);
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
      overflow-wrap: anywhere;
      text-decoration: none;
    }

    .liax-article-toc a:hover,
    .liax-article-toc a:focus-visible {
      color: var(--color-accent);
      text-decoration: underline;
      text-underline-offset: 0.18em;
    }

    .liax-article-body {
      min-width: 0;
      width: min(980px, 100%);
      max-width: 100%;
      margin: 0;
    }

    .liax-article-body img,
    .liax-article-body video {
      display: block;
      max-width: 100%;
      height: auto;
      border-radius: 8px;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      line-height: 1.25;
      overflow-wrap: anywhere;
    }

    p,
    li {
      overflow-wrap: anywhere;
    }

    a {
      color: var(--color-accent);
      text-decoration: underline;
      text-underline-offset: 0.18em;
    }

    a:hover,
    a:focus-visible {
      color: var(--color-text);
      outline-color: var(--color-accent);
    }

    .liax-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface-muted);
      color: var(--color-text);
      font: inherit;
      font-weight: 720;
      padding: 8px 14px;
      text-decoration: none;
    }

    .liax-button--primary {
      border-color: var(--color-primary);
      background: var(--color-primary);
      color: var(--color-primary-text);
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

    .liax-button:hover,
    .liax-button:focus-visible {
      box-shadow: 0 0 0 3px rgba(217, 119, 87, 0.22);
      color: var(--color-text);
      outline: 0;
    }

    .liax-button--primary:hover,
    .liax-button--primary:focus-visible {
      color: var(--color-primary-text);
    }

    .liax-button--brand:hover,
    .liax-button--brand:focus-visible {
      color: var(--color-brand-text);
    }

    .liax-language-icon-button:hover,
    .liax-language-icon-button:focus-visible {
      color: var(--color-text);
    }

    code {
      border: 1px solid rgb(80 86 124 / 54%);
      border-radius: 6px;
      background: #1a1b26;
      color: #c0caf5;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      padding: 0.1em 0.35em;
    }

    pre {
      position: relative;
      max-width: 100%;
      overflow-x: auto;
      border: 1px solid #2f3549;
      border-radius: 8px;
      background: #1a1b26;
      color: #c0caf5;
      padding: 16px;
      box-shadow: inset 0 1px 0 rgb(255 255 255 / 4%);
      scrollbar-color: #3b4261 #1a1b26;
    }

    .liax-code-frame {
      padding-top: 44px;
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

    pre code {
      border: 0;
      background: transparent;
      color: inherit;
      display: block;
      padding: 0;
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

    .liax-math {
      display: inline-block;
      border: 1px solid var(--color-border);
      border-radius: 6px;
      background: var(--color-surface-muted);
      padding: 0.08em 0.38em;
      font-family: "Times New Roman", serif;
    }

    blockquote {
      border-left: 4px solid var(--color-accent);
      background: var(--color-surface-muted);
      margin: 24px 0;
      padding: 12px 18px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
    }

    th,
    td {
      border: 1px solid var(--color-border);
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background: var(--color-surface-muted);
      font-weight: 760;
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

      .liax-article-tags {
        position: static;
        inset: auto;
        width: auto;
        max-height: none;
        margin-top: 14px;
        overflow: visible;
        box-shadow: none;
        backdrop-filter: none;
      }
    }

    @media (max-width: 720px) {
      .liax-public-shell {
        padding: 0;
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
        justify-content: end;
      }

      .liax-public-brand {
        flex: 0 0 auto;
      }

      .liax-language-switch {
        justify-content: center;
      }

      .liax-public-menu {
        display: none;
      }

      .liax-article-card {
        width: 100%;
        margin: 0;
        padding: 22px 16px 36px;
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
        <span class="liax-public-logo" aria-hidden="true">LS</span>
        <span>Liax Space</span>
      </a>
      <div class="liax-public-header__center">
        <nav class="liax-public-menu" aria-label="Primary">
          ${renderPublicMenuLinks(localePrefix, input.locale ?? "en-US")}
        </nav>
${languageSwitchHtml}
      </div>
      <div class="liax-public-header__tools">
        ${renderPublicSearchForm(localePrefix, input.locale ?? "en-US", "inline")}
        ${renderPublicMenuToggle(input.locale ?? "en-US")}
        <a class="liax-public-avatar" href="/console" aria-label="Console">A</a>
      </div>
    </header>
    ${renderPublicSidebar(localePrefix, input.locale ?? "en-US")}
    <main class="liax-article-card">
      <header class="liax-article-header">
        <h1>${title}</h1>
${renderArticleAudience(input)}
      </header>
${renderArticleToc(input)}      <article class="liax-article-body">
${input.bodyHtml}
      </article>
    </main>
  </div>
${renderLanguageSwitchScript()}
<script>
document.querySelectorAll(".liax-article-body img").forEach((image) => {
  image.addEventListener("error", () => image.remove(), { once: true });
});
</script>
</body>
</html>`;
  }
}
