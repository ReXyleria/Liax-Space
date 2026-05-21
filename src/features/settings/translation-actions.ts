"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireUser } from "@/lib/auth";
import { assertPermission, canManageSettings } from "@/lib/permissions";
import { retryPublicContentTranslationJob } from "@/features/i18n/public-content-translations";
import {
  getTranslationConfig,
  parseTranslationSettingsInput,
  testTranslationConnection,
  testTranslationSample,
  updateTranslationSettings,
  type TranslationConfig,
  type TranslationSettingsInput
} from "@/features/settings/translation-settings";

export type TranslationActionState = {
  ok: boolean;
  message: string;
  sample?: {
    title: string;
    summary: string | null;
    contentHtml: string;
  };
};

function resolveTestConfig(config: TranslationConfig, input: TranslationSettingsInput) {
  const apiKey = input.apiKey && !input.apiKey.includes("*") ? input.apiKey : config.apiKey;
  const baseUrl = input.baseUrl || config.baseUrl;
  const model = input.model || config.model;

  return {
    ...config,
    enabled: input.enabled,
    provider: input.provider || config.provider,
    baseUrl,
    apiKey,
    model,
    sourceLang: input.sourceLang || config.sourceLang,
    targetLang: input.targetLang || config.targetLang,
    timeoutMs: input.timeoutMs || config.timeoutMs,
    maxRetries: input.maxRetries ?? config.maxRetries,
    autoTranslate: input.autoTranslate,
    saveResult: input.saveResult,
    chunkingEnabled: input.chunkingEnabled,
    maxChunkChars: input.maxChunkChars || config.maxChunkChars,
    chunkConcurrency: input.chunkConcurrency || config.chunkConcurrency,
    isConfigured: Boolean(input.enabled && baseUrl && apiKey && model)
  };
}

function parseFormData(formData: FormData) {
  return parseTranslationSettingsInput(Object.fromEntries(formData.entries()));
}

export async function updateTranslationSettingsAction(
  _previousState: TranslationActionState,
  formData: FormData
): Promise<TranslationActionState> {
  try {
    const user = await requireUser();
    const input = parseFormData(formData);
    await updateTranslationSettings(user, input);
    revalidateTag("settings");
    revalidatePath("/console/settings/translation");
    return { ok: true, message: "翻译设置已保存。" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "保存翻译设置失败。"
    };
  }
}

export async function testTranslationConnectionAction(formData: FormData): Promise<TranslationActionState> {
  try {
    const user = await requireUser();
    assertPermission(canManageSettings(user), "你没有权限测试翻译设置。");
    const input = parseFormData(formData);
    const config = resolveTestConfig(await getTranslationConfig(), input);
    if (!config.baseUrl || !config.apiKey || !config.model) {
      return { ok: false, message: "请先配置 API Base URL、API Key 和模型。" };
    }
    await testTranslationConnection(config);
    return { ok: true, message: "连接成功。" };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "连接失败。"
    };
  }
}

export async function testTranslationSampleAction(formData: FormData): Promise<TranslationActionState> {
  try {
    const user = await requireUser();
    assertPermission(canManageSettings(user), "你没有权限测试翻译设置。");
    const input = parseFormData(formData);
    const config = resolveTestConfig(await getTranslationConfig(), input);
    if (!config.baseUrl || !config.apiKey || !config.model) {
      return { ok: false, message: "请先配置 API Base URL、API Key 和模型。" };
    }
    const sample = await testTranslationSample(config);
    return { ok: true, message: "测试翻译完成。", sample };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "测试翻译失败。"
    };
  }
}

export async function retryPublicContentTranslationJobAction(formData: FormData) {
  const user = await requireUser();
  await retryPublicContentTranslationJob(user, String(formData.get("jobId") ?? ""));
  revalidatePath("/console/settings/translation");
}
