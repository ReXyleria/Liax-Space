import type { Locale } from "@/lib/i18n-messages";

export type UrlLocale = "zh-CN" | "en-US";

export const urlLocales: UrlLocale[] = ["zh-CN", "en-US"];

export function isUrlLocale(value: unknown): value is UrlLocale {
  return value === "zh-CN" || value === "en-US";
}

export function localeToUrlLocale(locale: Locale | string | null | undefined): UrlLocale {
  return String(locale ?? "").toLowerCase().startsWith("en") ? "en-US" : "zh-CN";
}

export function urlLocaleToLocale(locale: UrlLocale | string): Locale | null {
  if (locale === "zh-CN") {
    return "zh-CN";
  }
  if (locale === "en-US") {
    return "en";
  }
  return null;
}

export function stripUrlLocale(pathname: string) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const segments = normalized.split("/");
  if (isUrlLocale(segments[1])) {
    const stripped = `/${segments.slice(2).join("/")}`.replace(/\/+$/, "");
    return stripped || "/";
  }
  return normalized || "/";
}

export function getUrlLocaleFromPathname(pathname: string): UrlLocale | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  return isUrlLocale(segment) ? segment : null;
}

export function localizedPath(locale: Locale | UrlLocale | string, path = "/") {
  const urlLocale = localeToUrlLocale(locale);
  const marker = path.search(/[?#]/);
  const rawPathname = marker >= 0 ? path.slice(0, marker) : path;
  const suffix = marker >= 0 ? path.slice(marker) : "";
  const stripped = stripUrlLocale(rawPathname || "/");
  const pathname = stripped === "/" ? "" : stripped;

  return `/${urlLocale}${pathname}${suffix}`;
}

export function articleHref(locale: Locale | UrlLocale | string, slug: string) {
  return localizedPath(locale, `/articles/${encodeURIComponent(slug)}`);
}
