import type { TemplateRenderInput } from "./renderer.types.js";

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
  const closeLabel = locale === "zh-CN" ? "关闭导航" : "Close navigation";

  return `<div class="liax-public-sidebar-layer" aria-hidden="true" inert data-public-sidebar-layer>
      <button class="liax-public-sidebar-backdrop" type="button" aria-label="${closeLabel}" data-public-sidebar-close></button>
      <aside class="liax-public-sidebar" aria-label="${closeLabel}">
        ${renderPublicSearchForm(localePrefix, locale, "sidebar")}
        <nav class="liax-public-sidebar-menu" aria-label="Primary">
          ${renderPublicMenuLinks(localePrefix, locale)}
        </nav>
      </aside>
    </div>`;
}

export function renderLanguageSwitchScript(): string {
  return `<script>
(() => {
  const buttonSelector = "[data-locale-target]";
  const sidebarLayerSelector = "[data-public-sidebar-layer]";
  const sidebarToggleSelector = "[data-public-sidebar-toggle]";
  const sidebarCloseSelector = "[data-public-sidebar-close]";
  const searchInputSelector = "[data-public-search-overlay-trigger]";
  const durationMs = 900;
  const adminLocaleStorageKey = "liax.admin.locale";
  const localeCookieKey = "liax.locale";
  const publicLocaleStorageKey = "liax.public.locale";
  let isSwitching = false;
  let activeSearchOverlay = null;

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
    if (isOpen) {
      window.setTimeout(() => layer.querySelector(".liax-public-sidebar .liax-public-search")?.focus(), shouldReduceMotion() ? 0 : 180);
    }
  }

  function closeSidebars() {
    document.querySelectorAll(sidebarLayerSelector).forEach((layer) => setSidebarOpen(layer, false));
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

  function originFromEvent(event, element) {
    if (event.clientX !== 0 || event.clientY !== 0) {
      return { x: event.clientX, y: event.clientY };
    }
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function radiusForViewport(origin) {
    const farthestX = Math.max(origin.x, window.innerWidth - origin.x);
    const farthestY = Math.max(origin.y, window.innerHeight - origin.y);
    return Math.ceil(Math.hypot(farthestX, farthestY));
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
    const currentHeader = document.querySelector(".liax-public-header");
    const targetHeader = targetDocument.querySelector(".liax-public-header");
    const currentMain = document.querySelector("main");
    const targetMain = readMain(targetDocument);
    const currentFooter = document.querySelector("footer");
    const targetFooter = targetDocument.querySelector("footer");
    const currentSidebar = document.querySelector(sidebarLayerSelector);
    const targetSidebar = targetDocument.querySelector(sidebarLayerSelector);
    if (currentHeader && targetHeader) {
      currentHeader.replaceWith(targetHeader.cloneNode(true));
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
    window.scrollTo({ top: 0 });
  }

  function createOverlay(targetDocument, origin) {
    const overlay = document.createElement("div");
    const rippleOne = document.createElement("span");
    const rippleTwo = document.createElement("span");
    const radius = radiusForViewport(origin);
    const overlayWidth = document.documentElement.clientWidth;
    const overlayHeight = window.innerHeight;
    const shell = document.createElement("div");
    const targetHeader = targetDocument.querySelector(".liax-public-header");
    const targetMain = readMain(targetDocument);
    shell.className = "liax-public-shell";
    if (targetHeader) {
      shell.append(targetHeader.cloneNode(true));
    }
    shell.append(targetMain.cloneNode(true));
    shell.querySelectorAll(".liax-public-header, main, footer, .liax-section-card, .liax-article-card").forEach((node) => {
      node.style.animation = "none";
      node.style.transform = "none";
    });
    Object.assign(shell.style, {
      opacity: "0",
      transform: "translateY(10px)",
      transition: \`opacity 360ms ease 120ms, transform 520ms cubic-bezier(0.22, 1, 0.36, 1) 120ms\`
    });
    overlay.dataset.languageWipeOverlay = "true";
    Object.assign(overlay.style, {
      background: "rgba(250, 249, 245, 0.98)",
      backdropFilter: "blur(2px)",
      clipPath: \`circle(0px at \${origin.x}px \${origin.y}px)\`,
      color: "#141413",
      height: \`\${overlayHeight}px\`,
      insetBlockStart: "0",
      insetInlineStart: "0",
      overflow: "auto",
      position: "fixed",
      transition: \`clip-path \${durationMs}ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 240ms ease\`,
      width: \`\${overlayWidth}px\`,
      zIndex: "2147483646"
    });
    [rippleOne, rippleTwo].forEach((ripple, index) => {
      Object.assign(ripple.style, {
        animation: \`\${index === 0 ? "liax-language-wipe-ripple" : "liax-language-wipe-ripple-soft"} \${durationMs}ms cubic-bezier(0.22, 1, 0.36, 1) \${index * 90}ms forwards\`,
        border: "2px solid rgba(217, 119, 87, 0.34)",
        borderRadius: "999px",
        boxShadow: "0 0 0 1px rgba(250, 249, 245, 0.72), 0 0 40px rgba(217, 119, 87, 0.16), 0 0 80px rgba(20, 20, 19, 0.05)",
        height: \`\${radius * 2}px\`,
        left: \`\${origin.x}px\`,
        opacity: "0",
        pointerEvents: "none",
        position: "fixed",
        top: \`\${origin.y}px\`,
        transform: "translate(-50%, -50%) scale(0)",
        width: \`\${radius * 2}px\`,
        zIndex: "2"
      });
      overlay.append(ripple);
    });
    overlay.append(shell);
    return overlay;
  }

  function animateOverlay(overlay, origin) {
    const radius = radiusForViewport(origin);
    return new Promise((resolve) => {
      let done = false;
      function finish() {
        if (!done) {
          done = true;
          resolve();
        }
      }
      overlay.addEventListener("transitionend", finish, { once: true });
      window.setTimeout(finish, durationMs + 80);
      overlay.getBoundingClientRect();
      window.setTimeout(() => {
        overlay.style.clipPath = \`circle(\${radius}px at \${origin.x}px \${origin.y}px)\`;
        const shell = overlay.querySelector(".liax-public-shell");
        if (shell) {
          shell.style.opacity = "1";
          shell.style.transform = "translateY(0)";
        }
      }, 24);
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
      backdropFilter: "blur(18px)",
      background: "rgba(250, 249, 245, 0.66)",
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
      border: "1px solid #d1cfc5",
      borderRadius: "8px",
      boxShadow: "0 24px 70px rgba(20, 20, 19, 0.18)",
      boxSizing: "border-box",
      display: "grid",
      gap: "8px",
      marginTop: "0",
      opacity: shouldReduceMotion() ? "1" : "0",
      padding: "14px",
      position: "relative",
      transform: shouldReduceMotion() ? "none" : "translateY(-16px) scale(0.98)",
      transition: "opacity 240ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
      width: "min(840px, calc(100vw - 40px))"
    });

    input.dataset.publicSearchOverlayInput = "true";
    input.name = "q";
    input.type = "search";
    input.value = sourceInput.value || "";
    input.placeholder = label;
    input.setAttribute("aria-label", label);
    Object.assign(input.style, {
      background: "#f5f4ed",
      border: "1px solid #d1cfc5",
      borderRadius: "999px",
      boxSizing: "border-box",
      color: "#141413",
      font: "inherit",
      fontSize: "20px",
      padding: "15px 18px",
      width: "100%"
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
      panel.style.transform = "translateY(0) scale(1)";
    });
    window.setTimeout(() => input.focus(), shouldReduceMotion() ? 0 : 180);
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
      const origin = originFromEvent(event, element);
      const overlay = createOverlay(targetDocument, origin);
      document.body.append(overlay);
      await animateOverlay(overlay, origin);
      replaceFromTarget(targetDocument);
      history.pushState({}, "", targetUrl);
      writeLocalePreference(locale);
      overlay.remove();
    } catch {
      window.location.href = targetUrl;
    } finally {
      isSwitching = false;
    }
  });
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
    }

    body {
      margin: 0;
      background: var(--color-page);
      color: var(--color-text);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.7;
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
    .liax-article-card {
      animation: liax-page-enter 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .liax-article-card {
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
      width: 100%;
      margin: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--color-text);
      padding: clamp(24px, 4vw, 56px);
    }

    .liax-article-header {
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

    .liax-article-body {
      max-width: 100%;
      margin: 0;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      line-height: 1.25;
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

    pre,
    code {
      background: var(--color-surface-muted);
      border: 1px solid var(--color-border);
      border-radius: 6px;
    }

    code {
      padding: 0.1em 0.35em;
    }

    pre {
      overflow: auto;
      padding: 16px;
    }

    pre code {
      border: 0;
      padding: 0;
    }

    .liax-code-keyword {
      color: var(--color-accent);
      font-weight: 760;
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

    @media (max-width: 720px) {
      .liax-public-shell {
        padding: 0;
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
      .liax-article-card {
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
      </header>
      <article class="liax-article-body">
${input.bodyHtml}
      </article>
    </main>
  </div>
${renderLanguageSwitchScript()}
</body>
</html>`;
  }
}
