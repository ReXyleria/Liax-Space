"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { LOCALE_COOKIE_NAME } from "@/lib/constants";
import { localizedPath } from "@/lib/locale-url";

export async function setLocaleAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "zh-CN") as Locale;
  const nextLocale = locale === "en" ? "en" : "zh-CN";
  const currentPath = String(formData.get("currentPath") ?? "");
  const currentSearch = String(formData.get("currentSearch") ?? "");
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, nextLocale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365
  });
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  if (currentPath.startsWith("/zh-CN") || currentPath.startsWith("/en-US") || currentPath === "/") {
    redirect(localizedPath(nextLocale, `${currentPath || "/"}${currentSearch}`));
  }
}
