"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { Locale } from "@/lib/i18n";
import { LOCALE_COOKIE_NAME } from "@/lib/constants";

export async function setLocaleAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "zh-CN") as Locale;
  const nextLocale = locale === "en" ? "en" : "zh-CN";
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, nextLocale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365
  });
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
}
