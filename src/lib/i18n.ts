export type { Locale } from "@/lib/i18n-messages";
export { localeLabels, messages, t } from "@/lib/i18n-messages";

// Server-only functions below. Do not import these from client components.
import { cookies, headers } from "next/headers";
import type { Locale } from "@/lib/i18n-messages";
import { LOCALE_COOKIE_NAME } from "@/lib/constants";

export async function getCurrentLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const saved = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (saved === "en" || saved === "zh-CN") {
    return saved;
  }

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language") ?? "";
  return acceptLanguage.toLowerCase().includes("zh") ? "zh-CN" : "en";
}

export async function getAdminLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const saved = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (saved === "en" || saved === "zh-CN") {
    return saved;
  }

  const headerStore = await headers();
  const acceptLanguage = headerStore.get("accept-language") ?? "";
  return acceptLanguage.toLowerCase().includes("zh") ? "zh-CN" : "en";
}
