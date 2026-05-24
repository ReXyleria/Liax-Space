"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  pushManualUrl,
  pushPublishedArticles,
  saveSitePushSettings,
  SitePushValidationError,
  type SitePushSubmissionSummary
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
        batchSubmitted: "Published article URLs submitted. Results were written to records.",
        noUrls: "No indexable published article URLs are available to push.",
        summary: (summary: SitePushSubmissionSummary) =>
          `URLs ${summary.urls}, providers ${summary.providers}, records ${summary.records}, success ${summary.success}, failed ${summary.failed}, skipped ${summary.skipped}.`
      }
    : {
        error: "操作失败，请稍后重试。",
        saved: "站点推送配置已保存。",
        manualSubmitted: "推送请求已提交，结果已写入记录。",
        batchSubmitted: "已提交已发布文章 URL，结果已写入记录。",
        noUrls: "没有可推送的已发布文章 URL。",
        summary: (summary: SitePushSubmissionSummary) =>
          `URL ${summary.urls} 个，渠道 ${summary.providers} 个，记录 ${summary.records} 条，成功 ${summary.success} 条，失败 ${summary.failed} 条，跳过 ${summary.skipped} 条。`
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
    revalidateTag("settings");
    revalidatePath("/console/site-push");
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
    const summary = await pushManualUrl(user, formData);
    revalidatePath("/console/site-push");
    return {
      ok: summary.urls > 0 && summary.failed === 0,
      message: `${text.manualSubmitted} ${text.summary(summary)}`
    };
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
    const summary = await pushPublishedArticles(user);
    revalidatePath("/console/site-push");
    return {
      ok: summary.urls > 0 && summary.failed === 0,
      message: `${summary.urls ? text.batchSubmitted : text.noUrls} ${text.summary(summary)}`
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : text.error };
  }
}
