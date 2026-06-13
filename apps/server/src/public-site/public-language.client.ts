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
const overlayDurationMs = 900;

let isSwitchingLanguage = false;
let activeSearchOverlay: HTMLElement | null = null;

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

  if (isOpen) {
    window.setTimeout(() => {
      layer.querySelector<HTMLInputElement>(".liax-public-sidebar .liax-public-search")?.focus();
    }, prefersReducedMotion() ? 0 : 180);
  }
}

function closeSidebars(): void {
  document.querySelectorAll<HTMLElement>(sidebarLayerSelector).forEach((layer) => {
    setSidebarOpen(layer, false);
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

    if (!hreflang) {
      return;
    }

    alternates.set(hreflang, {
      href: new URL(link.href, window.location.href).toString(),
      hreflang
    });
  });

  return alternates;
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

function originFromClick(event: MouseEvent, element: HTMLElement): { x: number; y: number } {
  if (event.clientX !== 0 || event.clientY !== 0) {
    return {
      x: event.clientX,
      y: event.clientY
    };
  }

  const rect = element.getBoundingClientRect();

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function radiusForViewport(origin: { x: number; y: number }): number {
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
  const farthestX = Math.max(origin.x, viewportWidth - origin.x);
  const farthestY = Math.max(origin.y, viewportHeight - origin.y);

  return Math.ceil(Math.hypot(farthestX, farthestY));
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
    opacity: "0",
    transform: "translateY(10px)",
    transition: "opacity 360ms ease 120ms, transform 520ms cubic-bezier(0.22, 1, 0.36, 1) 120ms"
  });
  return shell;
}

function updateHeadFromTarget(targetDocument: Document): void {
  document.title = targetDocument.title;
  document.documentElement.lang = targetDocument.documentElement.lang;

  document.querySelectorAll('link[rel~="alternate"][hreflang], link[rel="canonical"]').forEach((node) => node.remove());
  targetDocument.querySelectorAll('link[rel~="alternate"][hreflang], link[rel="canonical"]').forEach((node) => {
    document.head.append(node.cloneNode(true));
  });

  const currentDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  const targetDescription = targetDocument.querySelector<HTMLMetaElement>('meta[name="description"]');

  if (currentDescription && targetDescription) {
    currentDescription.content = targetDescription.content;
  }
}

function replacePageFromTarget(targetDocument: Document): void {
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
  window.scrollTo({ top: 0 });
}

function createOverlay(targetDocument: Document, origin: { x: number; y: number }): HTMLElement {
  const overlay = document.createElement("div");
  const rippleOne = document.createElement("span");
  const rippleTwo = document.createElement("span");
  const radius = radiusForViewport(origin);
  const overlayWidth = document.documentElement.clientWidth;
  const overlayHeight = window.innerHeight;

  overlay.dataset.languageWipeOverlay = "true";
  Object.assign(overlay.style, {
    background: "rgba(250, 249, 245, 0.98)",
    backdropFilter: "blur(2px)",
    clipPath: `circle(0px at ${origin.x}px ${origin.y}px)`,
    color: "#141413",
    height: `${overlayHeight}px`,
    insetBlockStart: "0",
    insetInlineStart: "0",
    overflow: "auto",
    position: "fixed",
    transition: `clip-path ${overlayDurationMs}ms cubic-bezier(0.2, 0.9, 0.2, 1), opacity 240ms ease`,
    width: `${overlayWidth}px`,
    zIndex: "2147483646"
  });
  [rippleOne, rippleTwo].forEach((ripple, index) => {
    Object.assign(ripple.style, {
      animation: `${index === 0 ? "liax-language-wipe-ripple" : "liax-language-wipe-ripple-soft"} ${overlayDurationMs}ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 90}ms forwards`,
      border: "2px solid rgba(217, 119, 87, 0.34)",
      borderRadius: "999px",
      boxShadow: "0 0 0 1px rgba(250, 249, 245, 0.72), 0 0 40px rgba(217, 119, 87, 0.16), 0 0 80px rgba(20, 20, 19, 0.05)",
      height: `${radius * 2}px`,
      left: `${origin.x}px`,
      opacity: "0",
      pointerEvents: "none",
      position: "fixed",
      top: `${origin.y}px`,
      transform: "translate(-50%, -50%) scale(0)",
      width: `${radius * 2}px`,
      zIndex: "2"
    });
    overlay.append(ripple);
  });
  overlay.append(cloneOverlayContent(targetDocument));

  return overlay;
}

function runOverlayAnimation(overlay: HTMLElement, origin: { x: number; y: number }): Promise<void> {
  const radius = radiusForViewport(origin);

  return new Promise((resolve) => {
    let isDone = false;

    function finish(): void {
      if (isDone) {
        return;
      }

      isDone = true;
      resolve();
    }

    overlay.addEventListener("transitionend", finish, { once: true });
    window.setTimeout(finish, overlayDurationMs + 80);

    overlay.getBoundingClientRect();
    window.setTimeout(() => {
      overlay.style.clipPath = `circle(${radius}px at ${origin.x}px ${origin.y}px)`;
      const shell = overlay.querySelector<HTMLElement>(".liax-public-shell");

      if (shell) {
        shell.style.opacity = "1";
        shell.style.transform = "translateY(0)";
      }
    }, 24);
  });
}

async function switchLanguage(target: SwitchTarget, event: MouseEvent): Promise<void> {
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
    if (prefersReducedMotion()) {
      replacePageFromTarget(targetDocument);
      history.pushState({}, "", targetUrl.href);
      writeLocalePreference(target.locale);
      return;
    }

    const origin = originFromClick(event, target.element);
    const overlay = createOverlay(targetDocument, origin);

    document.body.append(overlay);
    await runOverlayAnimation(overlay, origin);
    replacePageFromTarget(targetDocument);
    history.pushState({}, "", targetUrl.href);
    writeLocalePreference(target.locale);
    overlay.remove();
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
    opacity: prefersReducedMotion() ? "1" : "0",
    padding: "14px",
    position: "relative",
    transform: prefersReducedMotion() ? "none" : "translateY(-16px) scale(0.98)",
    transition: "opacity 240ms ease, transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
    width: "min(840px, calc(100vw - 40px))"
  });

  input.dataset.publicSearchOverlayInput = "true";
  input.name = "q";
  input.type = "search";
  input.value = sourceInput.value;
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
    panel.style.transform = "translateY(0) scale(1)";
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
  void switchLanguage(target, event);
});
