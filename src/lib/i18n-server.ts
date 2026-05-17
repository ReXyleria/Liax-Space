import "server-only";

import { cookies, headers } from "next/headers";
import type { Locale } from "@/lib/i18n-messages";
import { LOCALE_COOKIE_NAME } from "@/lib/constants";

async function resolveRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const saved = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (saved === "en" || saved === "zh-CN") {
    return saved;
  }

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language") ?? "";
  return acceptLanguage.toLowerCase().includes("zh") ? "zh-CN" : "en";
}

export function getCurrentLocale() {
  return resolveRequestLocale();
}

export function getAdminLocale() {
  return resolveRequestLocale();
}
