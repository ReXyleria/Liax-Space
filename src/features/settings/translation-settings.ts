import { SettingType } from "@prisma/client";
import { db, isDatabaseConfigured } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { assertPermission, canManageSettings } from "@/lib/permissions";
import { sanitizeArticleHtml } from "@/lib/sanitize";

export type TranslationSettings = {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  apiKeyMasked: string;
  hasApiKey: boolean;
  model: string;
  sourceLang: string;
  targetLang: string;
  timeoutMs: number;
  maxRetries: number;
  autoTranslate: boolean;
  saveResult: boolean;
  chunkingEnabled: boolean;
  maxChunkChars: number;
  chunkConcurrency: number;
};

export type TranslationConfig = {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  sourceLang: string;
  targetLang: string;
  timeoutMs: number;
  maxRetries: number;
  autoTranslate: boolean;
  saveResult: boolean;
  chunkingEnabled: boolean;
  maxChunkChars: number;
  chunkConcurrency: number;
  isConfigured: boolean;
};

export type TranslationProgressUpdate = {
  completedUnits: number;
  totalUnits: number;
  message: string;
};

export type TranslationSettingsInput = {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  sourceLang: string;
  targetLang: string;
  timeoutMs: number;
  maxRetries: number;
  autoTranslate: boolean;
  saveResult: boolean;
  chunkingEnabled: boolean;
  maxChunkChars: number;
  chunkConcurrency: number;
};

const SETTING_KEYS = {
  enabled: "translation.enabled",
  provider: "translation.provider",
  baseUrl: "translation.baseUrl",
  apiKey: "translation.apiKey",
  model: "translation.model",
  sourceLang: "translation.sourceLang",
  targetLang: "translation.targetLang",
  timeoutMs: "translation.timeoutMs",
  maxRetries: "translation.maxRetries",
  autoTranslate: "translation.autoTranslate",
  saveResult: "translation.saveResult",
  chunkingEnabled: "translation.chunkingEnabled",
  maxChunkChars: "translation.maxChunkChars",
  chunkConcurrency: "translation.chunkConcurrency"
} as const;

const LEGACY_KEYS: Partial<Record<keyof typeof SETTING_KEYS, string[]>> = {
  baseUrl: ["translation.apiBaseUrl", "translation.apiUrl"],
  sourceLang: ["translation.defaultSourceLanguage"],
  targetLang: ["translation.defaultTargetLanguage"],
  saveResult: ["translation.saveResults"]
};

const ALL_SETTING_KEYS = Array.from(
  new Set([
    ...Object.values(SETTING_KEYS),
    ...Object.values(LEGACY_KEYS).flatMap((keys) => keys ?? [])
  ])
);

const defaultValues = {
  enabled: false,
  provider: "custom",
  baseUrl: "",
  apiKey: "",
  model: "",
  sourceLang: "zh-CN",
  targetLang: "en-US",
  timeoutMs: 30000,
  maxRetries: 2,
  autoTranslate: true,
  saveResult: true,
  chunkingEnabled: true,
  maxChunkChars: 3500,
  chunkConcurrency: 2
};

function parseBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === "true" || value === "on" || value === "1";
  }
  return fallback;
}

function parseNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.trunc(parsed));
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeArticleSettingLocale(value: unknown, fallback: "zh-CN" | "en-US") {
  const normalized = normalizeString(value);
  return normalized === "zh-CN" || normalized === "en-US" ? normalized : fallback;
}

function normalizeProvider(value: unknown) {
  const normalized = normalizeString(value);
  if (!normalized || normalized.includes("compatible")) {
    return defaultValues.provider;
  }
  return normalized;
}

function maskApiKey(value: string) {
  if (!value) {
    return "";
  }
  if (value.length <= 6) {
    return "******";
  }
  return `${value.slice(0, 3)}******${value.slice(-3)}`;
}

function pickValue(
  map: Map<string, string>,
  keyName: keyof typeof SETTING_KEYS,
  fallback: string
) {
  const primary = map.get(SETTING_KEYS[keyName]);
  if (primary !== undefined && primary !== null && primary !== "") {
    return primary;
  }

  for (const legacyKey of LEGACY_KEYS[keyName] ?? []) {
    const value = map.get(legacyKey);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return fallback;
}

async function loadTranslationSettingsMap() {
  if (!isDatabaseConfigured()) {
    return { map: new Map<string, string>(), error: "DATABASE_URL 未配置，无法读取翻译设置。" };
  }

  try {
    const rows = await db.setting.findMany({
      where: { key: { in: ALL_SETTING_KEYS } },
      select: { key: true, value: true }
    });

    return {
      map: new Map(rows.map((row) => [row.key, row.value])),
      error: null as string | null
    };
  } catch (error) {
    console.error("读取翻译设置失败", error);
    return { map: new Map<string, string>(), error: "读取翻译设置失败。" };
  }
}

function normalizeConfigNumbers(input: {
  timeoutMs: number;
  maxRetries: number;
  maxChunkChars: number;
  chunkConcurrency: number;
}) {
  return {
    timeoutMs: Math.min(120000, Math.max(5000, input.timeoutMs)),
    maxRetries: Math.min(5, Math.max(0, input.maxRetries)),
    maxChunkChars: Math.min(12000, Math.max(800, input.maxChunkChars)),
    chunkConcurrency: Math.min(4, Math.max(1, input.chunkConcurrency))
  };
}

function buildConfig(map: Map<string, string>): TranslationConfig {
  const envBaseUrl = process.env.TRANSLATION_API_URL ?? "";
  const envApiKey = process.env.TRANSLATION_API_KEY ?? "";
  const envModel = process.env.TRANSLATION_MODEL ?? "";
  const envConfigured = Boolean(envBaseUrl && envApiKey && envModel);
  const enabled = parseBoolean(map.get(SETTING_KEYS.enabled), envConfigured || defaultValues.enabled);
  const numbers = normalizeConfigNumbers({
    timeoutMs: parseNumber(pickValue(map, "timeoutMs", String(defaultValues.timeoutMs)), defaultValues.timeoutMs),
    maxRetries: parseNumber(pickValue(map, "maxRetries", String(defaultValues.maxRetries)), defaultValues.maxRetries),
    maxChunkChars: parseNumber(pickValue(map, "maxChunkChars", String(defaultValues.maxChunkChars)), defaultValues.maxChunkChars),
    chunkConcurrency: parseNumber(pickValue(map, "chunkConcurrency", String(defaultValues.chunkConcurrency)), defaultValues.chunkConcurrency)
  });
  const baseUrl = pickValue(map, "baseUrl", envBaseUrl || defaultValues.baseUrl);
  const apiKey = pickValue(map, "apiKey", envApiKey || defaultValues.apiKey);
  const model = pickValue(map, "model", envModel || defaultValues.model);

  return {
    enabled,
    provider: normalizeProvider(pickValue(map, "provider", defaultValues.provider)),
    baseUrl,
    apiKey,
    model,
    sourceLang: normalizeArticleSettingLocale(pickValue(map, "sourceLang", defaultValues.sourceLang), "zh-CN"),
    targetLang: normalizeArticleSettingLocale(pickValue(map, "targetLang", defaultValues.targetLang), "en-US"),
    timeoutMs: numbers.timeoutMs,
    maxRetries: numbers.maxRetries,
    autoTranslate: parseBoolean(map.get(SETTING_KEYS.autoTranslate), defaultValues.autoTranslate),
    saveResult: parseBoolean(pickValue(map, "saveResult", String(defaultValues.saveResult)), defaultValues.saveResult),
    chunkingEnabled: parseBoolean(map.get(SETTING_KEYS.chunkingEnabled), defaultValues.chunkingEnabled),
    maxChunkChars: numbers.maxChunkChars,
    chunkConcurrency: numbers.chunkConcurrency,
    isConfigured: Boolean(enabled && baseUrl && apiKey && model)
  };
}

export async function getTranslationConfig(): Promise<TranslationConfig> {
  const { map } = await loadTranslationSettingsMap();
  return buildConfig(map);
}

export async function getTranslationSettings(): Promise<{ settings: TranslationSettings; error?: string }> {
  const { map, error } = await loadTranslationSettingsMap();
  const config = buildConfig(map);

  return {
    settings: {
      enabled: config.enabled,
      provider: config.provider,
      baseUrl: config.baseUrl,
      apiKeyMasked: config.apiKey ? maskApiKey(config.apiKey) : "",
      hasApiKey: Boolean(config.apiKey),
      model: config.model,
      sourceLang: config.sourceLang,
      targetLang: config.targetLang,
      timeoutMs: config.timeoutMs,
      maxRetries: config.maxRetries,
      autoTranslate: config.autoTranslate,
      saveResult: config.saveResult,
      chunkingEnabled: config.chunkingEnabled,
      maxChunkChars: config.maxChunkChars,
      chunkConcurrency: config.chunkConcurrency
    },
    error: error ?? undefined
  };
}

export function parseTranslationSettingsInput(values: Record<string, unknown>): TranslationSettingsInput {
  const numbers = normalizeConfigNumbers({
    timeoutMs: parseNumber(values.timeoutMs, defaultValues.timeoutMs),
    maxRetries: parseNumber(values.maxRetries, defaultValues.maxRetries),
    maxChunkChars: parseNumber(values.maxChunkChars, defaultValues.maxChunkChars),
    chunkConcurrency: parseNumber(values.chunkConcurrency, defaultValues.chunkConcurrency)
  });

  return {
    enabled: parseBoolean(values.enabled, defaultValues.enabled),
    provider: normalizeProvider(values.provider),
    baseUrl: normalizeString(values.baseUrl),
    apiKey: normalizeString(values.apiKey),
    model: normalizeString(values.model),
    sourceLang: normalizeArticleSettingLocale(values.sourceLang, "zh-CN"),
    targetLang: normalizeArticleSettingLocale(values.targetLang, "en-US"),
    timeoutMs: numbers.timeoutMs,
    maxRetries: numbers.maxRetries,
    autoTranslate: parseBoolean(values.autoTranslate, defaultValues.autoTranslate),
    saveResult: parseBoolean(values.saveResult, defaultValues.saveResult),
    chunkingEnabled: parseBoolean(values.chunkingEnabled, defaultValues.chunkingEnabled),
    maxChunkChars: numbers.maxChunkChars,
    chunkConcurrency: numbers.chunkConcurrency
  };
}

export async function updateTranslationSettings(user: CurrentUser, input: TranslationSettingsInput) {
  assertPermission(canManageSettings(user), "你没有权限管理翻译设置。");

  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const existingKey = await db.setting.findUnique({
    where: { key: SETTING_KEYS.apiKey },
    select: { value: true }
  });
  const apiKeyMasked = input.apiKey.includes("*");
  const shouldUpdateApiKey = Boolean(input.apiKey) && !apiKeyMasked;
  const apiKeyValue = shouldUpdateApiKey ? input.apiKey : existingKey?.value ?? "";

  const updates: Array<{ key: string; value: string; type: SettingType }> = [
    { key: SETTING_KEYS.enabled, value: String(input.enabled), type: SettingType.BOOLEAN },
    { key: SETTING_KEYS.provider, value: normalizeProvider(input.provider), type: SettingType.TEXT },
    { key: SETTING_KEYS.baseUrl, value: input.baseUrl, type: SettingType.TEXT },
    { key: SETTING_KEYS.model, value: input.model, type: SettingType.TEXT },
    { key: SETTING_KEYS.sourceLang, value: input.sourceLang, type: SettingType.TEXT },
    { key: SETTING_KEYS.targetLang, value: input.targetLang, type: SettingType.TEXT },
    { key: SETTING_KEYS.timeoutMs, value: String(input.timeoutMs), type: SettingType.NUMBER },
    { key: SETTING_KEYS.maxRetries, value: String(input.maxRetries), type: SettingType.NUMBER },
    { key: SETTING_KEYS.autoTranslate, value: String(input.autoTranslate), type: SettingType.BOOLEAN },
    { key: SETTING_KEYS.saveResult, value: String(input.saveResult), type: SettingType.BOOLEAN },
    { key: SETTING_KEYS.chunkingEnabled, value: String(input.chunkingEnabled), type: SettingType.BOOLEAN },
    { key: SETTING_KEYS.maxChunkChars, value: String(input.maxChunkChars), type: SettingType.NUMBER },
    { key: SETTING_KEYS.chunkConcurrency, value: String(input.chunkConcurrency), type: SettingType.NUMBER }
  ];

  if (shouldUpdateApiKey || (apiKeyValue && !existingKey?.value)) {
    updates.push({ key: SETTING_KEYS.apiKey, value: apiKeyValue, type: SettingType.PASSWORD });
  }

  await db.$transaction(
    updates.map((setting) =>
      db.setting.upsert({
        where: { key: setting.key },
        update: {
          value: setting.value,
          group: "translation",
          type: setting.type
        },
        create: {
          key: setting.key,
          value: setting.value,
          group: "translation",
          type: setting.type
        }
      })
    )
  );
}

function targetLanguageLabel(value: string) {
  if (value === "zh-CN") {
    return "Simplified Chinese";
  }
  if (value === "en-US") {
    return "English";
  }
  return value;
}

function resolveEndpoint(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("请先配置 API 接口地址。");
  }
  if (trimmed.endsWith("/chat/completions")) {
    return trimmed;
  }
  return `${trimmed}/chat/completions`;
}

function extractJsonText(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

export async function callTranslationApi(
  config: TranslationConfig,
  input: {
    title: string;
    summary: string | null;
    contentHtml: string;
    targetLocale: string;
  },
  options?: {
    onProgress?: (progress: TranslationProgressUpdate) => void | Promise<void>;
  }
) {
  if (!config.enabled) {
    throw new Error("翻译未启用。");
  }
  if (!config.baseUrl || !config.apiKey || !config.model) {
    throw new Error("翻译配置不完整：需要接口地址、API 密钥和模型名称。");
  }

  const maxChunkChars = Math.max(800, config.maxChunkChars || 3500);

  if (config.chunkingEnabled && input.contentHtml.length > maxChunkChars) {
    const chunks = splitHtmlIntoChunks(input.contentHtml, maxChunkChars);
    const totalUnits = chunks.length + 1;
    await options?.onProgress?.({ completedUnits: 0, totalUnits, message: "Preparing translation" });
    const meta = await requestTranslationApi(config, {
      title: input.title,
      summary: input.summary,
      contentHtml: "",
      targetLocale: input.targetLocale,
      purpose: "meta"
    });
    await options?.onProgress?.({ completedUnits: 1, totalUnits, message: "Metadata translated" });
    const translatedChunks = await translateChunks(config, chunks, input.targetLocale, async (completedChunks) => {
      await options?.onProgress?.({
        completedUnits: completedChunks + 1,
        totalUnits,
        message: `Translated ${completedChunks}/${chunks.length} content chunks`
      });
    });

    return {
      title: meta.title,
      summary: meta.summary,
      contentHtml: sanitizeArticleHtml(translatedChunks.join(""))
    };
  }

  await options?.onProgress?.({ completedUnits: 0, totalUnits: 1, message: "Sending translation request" });
  const translated = await requestTranslationApi(config, { ...input, purpose: "article" });
  await options?.onProgress?.({ completedUnits: 1, totalUnits: 1, message: "Translation complete" });
  return translated;
}

function splitHtmlIntoChunks(html: string, maxChunkChars: number) {
  const tokens = (html.match(/[\s\S]*?(?:<\/(?:p|h1|h2|h3|h4|h5|h6|blockquote|pre|table|ul|ol|details|figure|div)>|$)/gi) ?? [])
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const source = tokens.length ? tokens : [html];
  const chunks: string[] = [];
  let current = "";

  for (const token of source) {
    if (!current) {
      current = token;
      continue;
    }

    if ((current + token).length > maxChunkChars) {
      chunks.push(current);
      current = token;
    } else {
      current += token;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks.flatMap((chunk) => {
    if (chunk.length <= maxChunkChars * 1.5) {
      return [chunk];
    }

    const pieces: string[] = [];
    for (let index = 0; index < chunk.length; index += maxChunkChars) {
      pieces.push(chunk.slice(index, index + maxChunkChars));
    }
    return pieces;
  });
}

async function translateChunks(
  config: TranslationConfig,
  chunks: string[],
  targetLocale: string,
  onChunkComplete?: (completedChunks: number) => void | Promise<void>
) {
  const results = new Array<string>(chunks.length);
  let nextIndex = 0;
  let completedChunks = 0;
  const concurrency = Math.min(4, Math.max(1, config.chunkConcurrency || 2));

  async function worker() {
    while (nextIndex < chunks.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        const translated = await requestTranslationApi(config, {
          title: `Chunk ${index + 1}`,
          summary: null,
          contentHtml: chunks[index],
          targetLocale,
          purpose: "chunk"
        });
        results[index] = translated.contentHtml;
        completedChunks += 1;
        await onChunkComplete?.(completedChunks);
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知错误";
        throw new Error(`第 ${index + 1} 段翻译失败：${message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker()));
  return results;
}

async function requestTranslationApi(
  config: TranslationConfig,
  input: {
    title: string;
    summary: string | null;
    contentHtml: string;
    targetLocale: string;
    purpose: "article" | "meta" | "chunk";
  }
) {
  const payload = {
    model: config.model,
    messages: [
      {
        role: "system",
        content:
          "You translate blog content. Return strict JSON only: {\"title\":\"...\",\"summary\":null|string,\"contentHtml\":\"...\"}. Preserve valid HTML tags and structure. Do not wrap the JSON in markdown."
      },
      {
        role: "user",
        content: JSON.stringify({
          task: input.purpose,
          targetLanguage: targetLanguageLabel(input.targetLocale),
          title: input.title,
          summary: input.summary,
          contentHtml: input.contentHtml
        })
      }
    ],
    temperature: 0.2
  };

  const endpoint = resolveEndpoint(config.baseUrl);

  const attemptRequest = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        const detail = body ? `：${body.slice(0, 400)}` : "";
        throw new Error(`翻译 API 返回 ${response.status}${detail}`);
      }

      const result = await response.json();
      const content = result?.choices?.[0]?.message?.content ?? result?.content;
      if (typeof content !== "string") {
        throw new Error("翻译 API 未返回文本内容。");
      }

      let parsed: { title?: unknown; summary?: unknown; contentHtml?: unknown };
      try {
        parsed = JSON.parse(extractJsonText(content)) as typeof parsed;
      } catch {
        throw new Error("翻译 API 返回内容不是合法 JSON。");
      }

      if (typeof parsed.title !== "string" || typeof parsed.contentHtml !== "string") {
        throw new Error("翻译 API JSON 缺少 title 或 contentHtml。");
      }

      const contentHtml = sanitizeArticleHtml(parsed.contentHtml);
      if (input.purpose !== "meta" && !contentHtml.trim()) {
        throw new Error("翻译后的正文为空。");
      }

      return {
        title: parsed.title,
        summary: typeof parsed.summary === "string" ? parsed.summary : null,
        contentHtml
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("翻译 API 请求超时。");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
    try {
      return await attemptRequest();
    } catch (error) {
      lastError = error;
      if (attempt >= config.maxRetries) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("翻译请求失败。");
}

export async function testTranslationConnection(config: TranslationConfig) {
  await callTranslationApi(config, {
    title: "Connection test",
    summary: null,
    contentHtml: "<p>Ping</p>",
    targetLocale: config.targetLang
  });
}

export async function testTranslationSample(config: TranslationConfig) {
  return callTranslationApi(config, {
    title: "测试文章",
    summary: "这是一段翻译测试摘要。",
    contentHtml: "<p>这是一段用于验证翻译 API 的正文。</p>",
    targetLocale: config.targetLang
  });
}
