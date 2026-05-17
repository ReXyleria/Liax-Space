"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  pushManualUrl,
  pushPublishedArticles,
  saveSitePushSettings,
  SitePushValidationError
} from "@/features/site-push/service";
import type { Locale } from "@/lib/i18n-messages";

export type SitePushActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

function getLocale(formData: FormData): Locale {
  return formData.get("locale") === "en" ? "en" : "zh-CN";
}

function copy(locale: Locale) {
  return locale === "en"
    ? {
        error: "Operation failed. Please try again.",
        saved: "Site push settings saved.",
        manualSubmitted: "Push request submitted. The result was written to records.",
        batchSubmitted: "Published article URLs submitted. Results were written to records."
      }
    : {
        error: "操作失败，请稍后重试。",
        saved: "站点推送配置已保存。",
        manualSubmitted: "推送请求已提交，结果已写入记录。",
        batchSubmitted: "已提交已发布文章 URL，结果已写入记录。"
      };
}

export async function saveSitePushSettingsAction(
  _previousState: SitePushActionState,
  formData: FormData
): Promise<SitePushActionState> {
  const text = copy(getLocale(formData));
  try {
    const user = await requireUser();
    await saveSitePushSettings(user, formData);
    revalidatePath("/admin/site-push");
    return { ok: true, message: text.saved };
  } catch (error) {
    if (error instanceof SitePushValidationError) {
      return { ok: false, message: error.message, fieldErrors: error.fieldErrors };
    }
    return { ok: false, message: error instanceof Error ? error.message : text.error };
  }
}

export async function pushManualUrlAction(
  _previousState: SitePushActionState,
  formData: FormData
): Promise<SitePushActionState> {
  const text = copy(getLocale(formData));
  try {
    const user = await requireUser();
    await pushManualUrl(user, formData);
    revalidatePath("/admin/site-push");
    return { ok: true, message: text.manualSubmitted };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : text.error };
  }
}

export async function pushPublishedArticlesAction(
  previousState: SitePushActionState,
  formData: FormData
): Promise<SitePushActionState> {
  void previousState;
  const text = copy(getLocale(formData));
  try {
    const user = await requireUser();
    await pushPublishedArticles(user);
    revalidatePath("/admin/site-push");
    return { ok: true, message: text.batchSubmitted };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : text.error };
  }
}
