export {};

type AlternateLanguage = {
  href: string;
  hreflang: string;
};

type SwitchTarget = {
  element: HTMLElement;
  locale: string;
  url: string;
};

const languageButtonSelector = "[data-locale-target]";
const sidebarLayerSelector = "[data-public-sidebar-layer]";
const sidebarToggleSelector = "[data-public-sidebar-toggle]";
const sidebarCloseSelector = "[data-public-sidebar-close]";
const searchInputSelector = "[data-public-search-overlay-trigger]";
const adminLocaleStorageKey = "liax.admin.locale";
const localeCookieKey = "liax.locale";
const publicLocaleStorageKey = "liax.public.locale";
const languageRefreshOutMs = 80;
const languageRefreshInMs = 120;

let isSwitchingLanguage = false;
let activeSearchOverlay: HTMLElement | null = null;

function removeDuplicateLanguageSwitches(): void {
  document.querySelectorAll<HTMLElement>(".liax-public-header .liax-language-switch[data-language-switch-placeholder]").forEach((node, index) => {
    if (index > 0) {
      node.remove();
    }
  });
}

function setSidebarOpen(layer: HTMLElement, isOpen: boolean): void {
  layer.classList.toggle("is-open", isOpen);
  layer.setAttribute("aria-hidden", isOpen ? "false" : "true");
  if (isOpen) {
    layer.removeAttribute("inert");
  } else {
    layer.setAttribute("inert", "");
  }
  document.querySelectorAll<HTMLElement>(sidebarToggleSelector).forEach((toggle) => {
    toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
}

function closeSidebars(): void {
  document.querySelectorAll<HTMLElement>(sidebarLayerSelector).forEach((layer) => {
    setSidebarOpen(layer, false);
  });
}

function currentPublicSection(): string {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const section = parts[1] || "home";

  if (parts.length >= 3 && parts[1] === "posts") {
    return "posts";
  }

  return ["home", "posts", "tags", "moments", "guestbook", "archives", "search"].includes(section) ? section : "";
}

function updatePublicNavigationState(): void {
  const activeSection = currentPublicSection();

  document.querySelectorAll<HTMLAnchorElement>(".liax-public-menu a, .liax-public-sidebar-menu a").forEach((link) => {
    const targetParts = (link.getAttribute("href") ?? "").split("?")[0].split("/").filter(Boolean);
    const targetSection = targetParts[1] || "home";

    if (activeSection && targetSection === activeSection) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function writeLocalePreference(locale: string): void {
  try {
    window.localStorage.setItem(adminLocaleStorageKey, locale);
    window.localStorage.setItem(publicLocaleStorageKey, locale);
  } catch {
    // Locale still applies through URL even if storage is unavailable.
  }

  document.cookie = `${localeCookieKey}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function unavailableMessage(): string {
  return document.documentElement.lang.toLowerCase().startsWith("zh")
    ? "目标语言暂不可用。"
    : "This language is not available.";
}

function readAlternates(): Map<string, AlternateLanguage> {
  const alternates = new Map<string, AlternateLanguage>();
  const links = document.querySelectorAll<HTMLLinkElement>('link[rel~="alternate"][hreflang][href]');

  links.forEach((link) => {
    const hreflang = link.hreflang.trim();
    const href = link.getAttribute("href") ?? "";

    if (!hreflang || !href.trim()) {
      return;
    }

    alternates.set(hreflang, {
      href: toCurrentOriginUrl(href),
      hreflang
    });
  });

  return alternates;
}

function toCurrentOriginUrl(value: string): string {
  const url = new URL(value, window.location.href);

  return `${window.location.origin}${url.pathname}${url.search}${url.hash}`;
}

function cloneHeadLinkForCurrentOrigin(link: HTMLLinkElement): HTMLLinkElement {
  const clonedLink = link.cloneNode(true) as HTMLLinkElement;
  const href = clonedLink.getAttribute("href");

  if (href?.trim()) {
    clonedLink.setAttribute("href", toCurrentOriginUrl(href));
  }

  return clonedLink;
}

function findSwitchTarget(event: MouseEvent): SwitchTarget | null {
  const element = (event.target instanceof Element ? event.target.closest<HTMLElement>(languageButtonSelector) : null);
  const locale = element?.dataset.localeTarget?.trim();

  if (!element || !locale) {
    return null;
  }

  const alternate = readAlternates().get(locale);

  if (!alternate) {
    return {
      element,
      locale,
      url: ""
    };
  }

  return {
    element,
    locale,
    url: alternate.href
  };
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function showUnavailableMessage(): void {
  let message = document.querySelector<HTMLElement>("[data-language-unavailable-message]");

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

  message.textContent = unavailableMessage();
  window.setTimeout(() => {
    message?.remove();
  }, 2600);
}

async function fetchTargetDocument(url: string): Promise<Document> {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: {
      Accept: "text/html"
    }
  });

  if (!response.ok) {
    throw new Error(`Target page returned ${response.status}.`);
  }

  const html = await response.text();
  return new DOMParser().parseFromString(html, "text/html");
}

function readTargetMain(targetDocument: Document): HTMLElement {
  const targetMain = targetDocument.querySelector<HTMLElement>("main");

  if (!targetMain) {
    throw new Error("Target page main content was not found.");
  }

  return targetMain;
}

function cloneOverlayContent(targetDocument: Document): HTMLElement {
  const shell = document.createElement("div");
  const targetHeader = targetDocument.querySelector<HTMLElement>(".liax-public-header");
  const targetMain = readTargetMain(targetDocument);

  shell.className = "liax-public-shell";

  if (targetHeader) {
    shell.append(targetHeader.cloneNode(true));
  }

  shell.append(targetMain.cloneNode(true));
  shell.querySelectorAll<HTMLElement>(".liax-public-header, main, footer, .liax-section-card, .liax-article-card").forEach((node) => {
    node.style.animation = "none";
    node.style.transform = "none";
  });
  Object.assign(shell.style, {
    opacity: "1",
    transform: "none",
    transition: "none"
  });
  return shell;
}

function updateHeadFromTarget(targetDocument: Document): void {
  document.title = targetDocument.title;
  document.documentElement.lang = targetDocument.documentElement.lang;

  document.querySelectorAll('link[rel~="alternate"][hreflang], link[rel="canonical"]').forEach((node) => node.remove());
  targetDocument.querySelectorAll<HTMLLinkElement>('link[rel~="alternate"][hreflang], link[rel="canonical"]').forEach((node) => {
    document.head.append(cloneHeadLinkForCurrentOrigin(node));
  });

  const currentDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  const targetDescription = targetDocument.querySelector<HTMLMetaElement>('meta[name="description"]');

  if (currentDescription && targetDescription) {
    currentDescription.content = targetDescription.content;
  }
}

function replacePageFromTarget(targetDocument: Document): void {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const currentHeader = document.querySelector<HTMLElement>(".liax-public-header");
  const targetHeader = targetDocument.querySelector<HTMLElement>(".liax-public-header");
  const currentMain = document.querySelector<HTMLElement>("main");
  const targetMain = readTargetMain(targetDocument);
  const currentFooter = document.querySelector<HTMLElement>(".liax-public-footer");
  const targetFooter = targetDocument.querySelector<HTMLElement>(".liax-public-footer");
  const currentSidebar = document.querySelector<HTMLElement>(sidebarLayerSelector);
  const targetSidebar = targetDocument.querySelector<HTMLElement>(sidebarLayerSelector);

  if (currentHeader && targetHeader) {
    currentHeader.replaceWith(targetHeader.cloneNode(true));
  }

  if (!currentMain) {
    throw new Error("Current page main content was not found.");
  }

  currentMain.replaceWith(targetMain.cloneNode(true));

  if (currentFooter && targetFooter) {
    currentFooter.replaceWith(targetFooter.cloneNode(true));
  }

  if (currentSidebar && targetSidebar) {
    currentSidebar.replaceWith(targetSidebar.cloneNode(true));
  }

  updateHeadFromTarget(targetDocument);
  removeDuplicateLanguageSwitches();
  updatePublicNavigationState();
  window.scrollTo({ left: scrollX, top: scrollY });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function refreshPageFromTarget(targetDocument: Document): Promise<void> {
  const currentMain = document.querySelector<HTMLElement>("main");
  const currentFooter = document.querySelector<HTMLElement>(".liax-public-footer, .liax-home-footer");
  const animatedNodes = [currentMain, currentFooter].filter((node): node is HTMLElement => node !== null);

  if (prefersReducedMotion() || animatedNodes.length === 0) {
    replacePageFromTarget(targetDocument);
    return;
  }

  animatedNodes.forEach((node) => {
    node.style.transition = `opacity ${languageRefreshOutMs}ms ease`;
    node.style.opacity = "0";
  });
  await sleep(languageRefreshOutMs);

  replacePageFromTarget(targetDocument);

  const nextMain = document.querySelector<HTMLElement>("main");
  const nextFooter = document.querySelector<HTMLElement>(".liax-public-footer, .liax-home-footer");
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
      node.style.transition = `opacity ${languageRefreshInMs}ms ease`;
      node.style.opacity = "1";
      window.setTimeout(() => {
        node.style.transition = "";
        node.style.opacity = "";
      }, languageRefreshInMs + 20);
    });
  });
}

async function switchLanguage(target: SwitchTarget): Promise<void> {
  if (!target.url) {
    showUnavailableMessage();
    return;
  }

  const targetUrl = new URL(target.url, window.location.href);

  if (targetUrl.href === window.location.href) {
    return;
  }

  if (isSwitchingLanguage) {
    return;
  }

  let targetDocument: Document;

  try {
    targetDocument = await fetchTargetDocument(targetUrl.href);
    readTargetMain(targetDocument);
  } catch {
    window.location.href = targetUrl.href;
    return;
  }

  isSwitchingLanguage = true;

  try {
    await refreshPageFromTarget(targetDocument);
    history.pushState({}, "", targetUrl.href);
    writeLocalePreference(target.locale);
  } catch {
    window.location.href = targetUrl.href;
  } finally {
    isSwitchingLanguage = false;
  }
}

function searchPlaceholder(): string {
  return document.documentElement.lang.toLowerCase().startsWith("zh") ? "搜索" : "Search";
}

function closeSearchOverlay(): void {
  if (!activeSearchOverlay) {
    return;
  }

  const overlay = activeSearchOverlay;
  activeSearchOverlay = null;
  document.querySelectorAll<HTMLElement>(searchInputSelector).forEach((input) => {
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

  if (prefersReducedMotion()) {
    overlay.remove();
    return;
  }

  overlay.style.opacity = "0";
  window.setTimeout(() => overlay.remove(), 180);
}

function openSearchOverlay(sourceInput: HTMLInputElement): void {
  if (activeSearchOverlay) {
    return;
  }

  const sourceForm = sourceInput.form;
  const targetUrl = sourceForm?.getAttribute("action") ?? window.location.pathname;
  const overlay = document.createElement("div");
  const backdrop = document.createElement("button");
  const panel = document.createElement("form");
  const input = document.createElement("input");
  const hint = document.createElement("p");
  const label = searchPlaceholder();

  document.querySelectorAll<HTMLElement>(searchInputSelector).forEach((input) => {
    input.setAttribute("aria-hidden", "true");
    input.dataset.publicSearchOriginalTabindex = input.getAttribute("tabindex") ?? "";
    input.setAttribute("tabindex", "-1");
    input.setAttribute("inert", "");
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
  backdrop.type = "button";
  backdrop.setAttribute("aria-label", label);
  Object.assign(backdrop.style, {
    backdropFilter: "blur(2px)",
    background: "rgba(250, 249, 245, 0.56)",
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
    boxShadow: "0 20px 60px rgba(20, 20, 19, 0.13)",
    boxSizing: "border-box",
    display: "grid",
    gap: "8px",
    marginTop: "0",
    opacity: prefersReducedMotion() ? "1" : "0",
    padding: "14px",
    position: "relative",
    transform: "none",
    transition: "opacity 140ms ease",
    width: "min(840px, calc(100vw - 40px))"
  });

  input.dataset.publicSearchOverlayInput = "true";
  input.name = "q";
  input.type = "search";
  input.value = sourceInput.value;
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

  hint.textContent = document.documentElement.lang.toLowerCase().startsWith("zh")
    ? "输入关键词后按 Enter 搜索，Esc 关闭。"
    : "Type keywords and press Enter. Esc closes search.";
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
  window.setTimeout(() => input.focus(), prefersReducedMotion() ? 0 : 180);
}

function findSearchInput(event: Event): HTMLInputElement | null {
  const input = event.target instanceof Element ? event.target.closest<HTMLInputElement>(searchInputSelector) : null;
  return input instanceof HTMLInputElement ? input : null;
}

document.addEventListener("click", (event) => {
  const input = findSearchInput(event);

  if (!input) {
    return;
  }

  event.preventDefault();
  openSearchOverlay(input);
});

document.addEventListener("focusin", (event) => {
  const input = findSearchInput(event);

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
  const toggle = event.target instanceof Element ? event.target.closest<HTMLElement>(sidebarToggleSelector) : null;

  if (toggle) {
    event.preventDefault();
    const layer = document.querySelector<HTMLElement>(sidebarLayerSelector);

    if (layer) {
      setSidebarOpen(layer, layer.getAttribute("aria-hidden") !== "false");
    }

    return;
  }

  const close = event.target instanceof Element ? event.target.closest<HTMLElement>(sidebarCloseSelector) : null;

  if (close) {
    event.preventDefault();
    closeSidebars();
  }
});

document.addEventListener("click", (event) => {
  const target = findSwitchTarget(event);

  if (!target) {
    return;
  }

  event.preventDefault();
  void switchLanguage(target);
});

removeDuplicateLanguageSwitches();
updatePublicNavigationState();
