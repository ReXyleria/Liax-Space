"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import {
  pushManualUrl,
  pushPublishedArticles,
  saveSitePushSettings
} from "@/features/site-push/service";

export type SitePushActionState = {
  ok: boolean;
  message: string;
};

const initialError = "操作失败，请稍后重试。";

export async function saveSitePushSettingsAction(
  _previousState: SitePushActionState,
  formData: FormData
): Promise<SitePushActionState> {
  try {
    const user = await requireUser();
    await saveSitePushSettings(user, formData);
    revalidatePath("/admin/site-push");
    return { ok: true, message: "站点推送配置已保存。" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : initialError };
  }
}

export async function pushManualUrlAction(
  _previousState: SitePushActionState,
  formData: FormData
): Promise<SitePushActionState> {
  try {
    const user = await requireUser();
    await pushManualUrl(user, formData);
    revalidatePath("/admin/site-push");
    return { ok: true, message: "推送请求已提交，结果已写入记录。" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : initialError };
  }
}

export async function pushPublishedArticlesAction(
  previousState: SitePushActionState,
  formData: FormData
): Promise<SitePushActionState> {
  void previousState;
  void formData;
  try {
    const user = await requireUser();
    await pushPublishedArticles(user);
    revalidatePath("/admin/site-push");
    return { ok: true, message: "已批量提交最近发布文章，结果已写入记录。" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : initialError };
  }
}
