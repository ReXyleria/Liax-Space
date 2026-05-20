import "server-only";

import { cookies, headers } from "next/headers";
import type { Locale } from "@/lib/i18n-messages";
import { LOCALE_COOKIE_NAME } from "@/lib/constants";
import { urlLocaleToLocale } from "@/lib/locale-url";

async function resolveRequestLocale(): Promise<Locale> {
  const headerStore = await headers();
  const urlLocale = urlLocaleToLocale(headerStore.get("x-liax-url-locale") ?? "");
  if (urlLocale) {
    return urlLocale;
  }

  const cookieStore = await cookies();
  const saved = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (saved === "en" || saved === "zh-CN") {
    return saved;
  }

  const acceptLanguage = headerStore.get("accept-language") ?? "";
  return acceptLanguage.toLowerCase().includes("zh") ? "zh-CN" : "en";
}

export function getCurrentLocale() {
  return resolveRequestLocale();
}

export function getConsoleLocale() {
  return resolveRequestLocale();
}
