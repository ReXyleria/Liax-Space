import type { TemplateRenderInput } from "./renderer.types.js";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderLanguageSwitchPlaceholder(input: TemplateRenderInput): string {
  const alternates = input.alternates ?? [];
  const links = alternates.length > 0
    ? alternates.map((alternate) => {
      const label = alternate.hreflang === "zh-CN" ? "切换到中文" : "Switch language";
      const visibleLabel = alternate.hreflang === "zh-CN" ? "中" : "EN";
      return `      <a class="liax-button liax-language-icon-button" aria-label="${escapeHtml(label)}" data-locale-target="${escapeHtml(alternate.hreflang)}" href="${escapeHtml(alternate.href)}">
        <span aria-hidden="true">${visibleLabel}</span>
      </a>`;
    }).join("\n")
    : `      <button class="liax-button liax-language-icon-button" data-locale-target="" disabled type="button">
        <span aria-hidden="true">EN</span>
      </button>`;

  return `    <nav class="liax-language-switch" aria-label="Language switch" data-language-switch-placeholder="true">
${links}
    </nav>`;
}

export function renderLanguageSwitchScript(): string {
  return `<script>
(() => {
  const buttonSelector = "[data-locale-target]";
  const searchInputSelector = ".liax-public-search-form .liax-public-search";
  const durationMs = 900;
  const adminLocaleStorageKey = "liax.admin.locale";
  const localeCookieKey = "liax.locale";
  const publicLocaleStorageKey = "liax.public.locale";
  let isSwitching = false;
  let activeSearchOverlay = null;

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
    overlay.dataset.languageWipeOverlay = "true";
    Object.assign(overlay.style, {
      background: "#faf9f5",
      clipPath: \`circle(0px at \${origin.x}px \${origin.y}px)\`,
      color: "#141413",
      height: \`\${overlayHeight}px\`,
      insetBlockStart: "0",
      insetInlineStart: "0",
      overflow: "auto",
      position: "fixed",
      transition: \`clip-path \${durationMs}ms ease\`,
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
      requestAnimationFrame(() => {
        overlay.style.clipPath = \`circle(\${radius}px at \${origin.x}px \${origin.y}px)\`;
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
      padding: "24px",
      position: "fixed",
      transition: "opacity 180ms ease",
      zIndex: "2147483645"
    });

    backdrop.dataset.publicSearchBackdrop = "true";
    backdrop.setAttribute("aria-label", label);
    Object.assign(backdrop.style, {
      backdropFilter: "blur(14px)",
      background: "rgba(250, 249, 245, 0.72)",
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
      boxShadow: "0 18px 46px rgba(20, 20, 19, 0.14)",
      boxSizing: "border-box",
      display: "grid",
      gap: "8px",
      marginTop: "max(16px, env(safe-area-inset-top))",
      opacity: shouldReduceMotion() ? "1" : "0",
      padding: "14px",
      position: "relative",
      transform: shouldReduceMotion() ? "none" : "translateY(-10px)",
      transition: "opacity 220ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
      width: "min(720px, calc(100vw - 32px))"
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
      fontSize: "18px",
      padding: "13px 16px",
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
      panel.style.transform = "translateY(0)";
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
      grid-template-columns: minmax(190px, 1fr) minmax(0, auto) minmax(48px, 1fr);
      align-items: center;
      gap: clamp(16px, 3vw, 32px);
      width: 100%;
      height: 76px;
      min-height: 76px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
      margin: 0;
      padding: 12px clamp(20px, 4vw, 48px);
    }

    .liax-public-brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
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
      grid-template-columns: 44px minmax(0, auto);
      justify-content: center;
      align-items: center;
      gap: 14px;
    }

    .liax-public-menu {
      flex: 1 1 auto;
      flex-wrap: nowrap;
      justify-content: center;
      min-width: 0;
      position: relative;
      z-index: 1;
    }

    .liax-public-menu a {
      color: var(--color-text);
      flex: 0 0 clamp(56px, 7vw, 84px);
      font-size: 14px;
      font-weight: 700;
      text-decoration: none;
      display: inline-flex;
      justify-content: center;
      width: clamp(56px, 7vw, 84px);
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
      gap: 8px;
      justify-content: center;
      position: relative;
      z-index: 2;
      width: 44px;
    }

    .liax-public-header__tools {
      justify-content: flex-end;
    }

    .liax-public-search {
      box-sizing: border-box;
      width: min(220px, 24vw);
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
      width: min(960px, calc(100% - 48px));
      margin: 32px auto 56px;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      color: var(--color-text);
      padding: 40px;
    }

    .liax-article-body {
      max-width: 760px;
      margin: 0 auto;
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
        grid-template-columns: auto minmax(0, auto) auto;
        height: 76px;
        min-height: 76px;
        gap: 14px;
        overflow-x: auto;
        padding: 10px 16px;
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
        grid-template-columns: 44px minmax(0, auto);
      }

      .liax-public-brand {
        flex: 0 0 auto;
      }

      .liax-language-switch {
        justify-content: center;
      }

      .liax-public-search {
        width: 118px;
      }

      .liax-public-search-form {
        width: auto;
      }

      .liax-article-card {
        width: calc(100% - 36px);
        margin: 18px auto 40px;
        padding: 24px;
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
${languageSwitchHtml}
        <nav class="liax-public-menu" aria-label="Primary">
          <a href="/${localePrefix}">${input.locale === "zh-CN" ? "首页" : "Home"}</a>
          <a href="/${localePrefix}/posts">${input.locale === "zh-CN" ? "文章" : "Articles"}</a>
          <a href="/${localePrefix}/tags">${input.locale === "zh-CN" ? "标签" : "Tags"}</a>
          <a href="/${localePrefix}/moments">${input.locale === "zh-CN" ? "瞬间" : "Moments"}</a>
          <a href="/${localePrefix}/guestbook">${input.locale === "zh-CN" ? "留言" : "Guestbook"}</a>
          <a href="/${localePrefix}/archives">${input.locale === "zh-CN" ? "归档" : "Archives"}</a>
        </nav>
      </div>
      <div class="liax-public-header__tools">
        <a class="liax-public-avatar" href="/${localePrefix}/account" aria-label="User">A</a>
      </div>
    </header>
    <main class="liax-article-card">
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
