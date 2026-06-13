import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from "../../../../packages/shared/src/locales";

const adminLocaleStorageKey = "liax.admin.locale";
const publicLocaleStorageKey = "liax.public.locale";
const localeCookieKey = "liax.locale";

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readStoredLocale(): SupportedLocale | null {
  const cookieLocale = readCookieLocale();

  if (cookieLocale) {
    return cookieLocale;
  }

  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const adminValue = window.localStorage.getItem(adminLocaleStorageKey);

    if (isSupportedLocale(adminValue)) {
      return adminValue;
    }

    const publicValue = window.localStorage.getItem(publicLocaleStorageKey);
    return isSupportedLocale(publicValue) ? publicValue : null;
  } catch {
    return null;
  }
}

export function writeStoredLocale(locale: SupportedLocale): void {
  writeCookieLocale(locale);

  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(adminLocaleStorageKey, locale);
    window.localStorage.setItem(publicLocaleStorageKey, locale);
  } catch {
    // Locale persistence is optional; UI state can still use the in-memory locale.
  }
}

function readCookieLocale(): SupportedLocale | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${localeCookieKey}=`));
  const value = cookie ? decodeURIComponent(cookie.slice(localeCookieKey.length + 1)) : null;

  return isSupportedLocale(value) ? value : null;
}

function writeCookieLocale(locale: SupportedLocale): void {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${localeCookieKey}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function detectBrowserLocale(): SupportedLocale {
  if (typeof navigator === "undefined") {
    return DEFAULT_LOCALE;
  }

  const languages = navigator.languages.length > 0 ? navigator.languages : [navigator.language];

  for (const language of languages) {
    if (isSupportedLocale(language)) {
      return language;
    }

    const baseLanguage = language.toLowerCase().split("-")[0];

    if (baseLanguage === "zh") {
      return "zh-CN";
    }

    if (baseLanguage === "en") {
      return "en-US";
    }
  }

  return DEFAULT_LOCALE;
}

export function resolveInitialLocale(): SupportedLocale {
  return readStoredLocale() ?? detectBrowserLocale() ?? DEFAULT_LOCALE;
}
