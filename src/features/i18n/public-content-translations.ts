import { createHash } from "crypto";
import {
  Prisma,
  PublicContentTranslationEntity,
  PublicContentTranslationJobStatus,
  TranslationStatus
} from "@prisma/client";
import { db, isDatabaseConfigured, withDatabase } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";
import { assertPermission, canManageSettings } from "@/lib/permissions";
import { shouldRunInProcessWorkers } from "@/lib/background-worker";
import { getTranslationConfig, type TranslationConfig } from "@/features/settings/translation-settings";

export type PublicTranslationFields = Record<string, string>;

const ACTIVE_STATUSES: PublicContentTranslationJobStatus[] = [
  PublicContentTranslationJobStatus.QUEUED,
  PublicContentTranslationJobStatus.RUNNING
];

const STALE_RUNNING_MS = 15 * 60 * 1000;
let workerRunning = false;

function normalizeLocale(locale: string | null | undefined) {
  return String(locale ?? "").toLowerCase().startsWith("en") ? "en" : "zh-CN";
}

function targetLanguageLabel(locale: string) {
  return normalizeLocale(locale) === "en" ? "English" : "Simplified Chinese";
}

function normalizeFields(fields: Record<string, unknown>): PublicTranslationFields {
  return Object.fromEntries(
    Object.entries(fields)
      .map(([key, value]) => [key, typeof value === "string" ? value.trim() : ""])
      .filter(([, value]) => value)
  );
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashSource(entity: PublicContentTranslationEntity, entityId: string, fields: PublicTranslationFields) {
  return createHash("sha256")
    .update(stableStringify({ entity, entityId, fields }))
    .digest("hex");
}

function resolveEndpoint(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("请先配置翻译 API 接口地址。");
  }
  return trimmed.endsWith("/chat/completions") ? trimmed : `${trimmed}/chat/completions`;
}

function extractJsonText(value: string) {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function parseTranslatedFields(content: string, requestedFields: PublicTranslationFields) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(content));
  } catch {
    throw new Error("公共内容翻译 API 返回内容不是合法 JSON。");
  }

  const rawFields =
    parsed && typeof parsed === "object" && "fields" in parsed
      ? (parsed as { fields?: unknown }).fields
      : parsed;

  if (!rawFields || typeof rawFields !== "object" || Array.isArray(rawFields)) {
    throw new Error("公共内容翻译 API JSON 缺少 fields 对象。");
  }

  const translated: PublicTranslationFields = {};
  for (const key of Object.keys(requestedFields)) {
    const value = (rawFields as Record<string, unknown>)[key];
    translated[key] = typeof value === "string" && value.trim() ? value.trim() : requestedFields[key];
  }

  return translated;
}

async function requestPublicContentTranslation(
  config: TranslationConfig,
  fields: PublicTranslationFields,
  targetLocale: string
) {
  if (!config.enabled) {
    throw new Error("翻译未启用。");
  }
  if (!config.baseUrl || !config.apiKey || !config.model) {
    throw new Error("翻译配置不完整：需要接口地址、API Key 和模型名称。");
  }

  const payload = {
    model: config.model,
    messages: [
      {
        role: "system",
        content:
          "Translate short public website content. Return strict JSON only: {\"fields\":{\"key\":\"translated text\"}}. Preserve field keys. Do not add markdown."
      },
      {
        role: "user",
        content: JSON.stringify({
          targetLanguage: targetLanguageLabel(targetLocale),
          fields
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
        throw new Error(`公共内容翻译 API 返回 ${response.status}${detail}`);
      }

      const result = await response.json();
      const content = result?.choices?.[0]?.message?.content ?? result?.content;
      if (typeof content !== "string") {
        throw new Error("公共内容翻译 API 未返回文本内容。");
      }

      return parseTranslatedFields(content, fields);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("公共内容翻译 API 请求超时。");
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

  throw lastError instanceof Error ? lastError : new Error("公共内容翻译请求失败。");
}

export async function queuePublicContentTranslation(input: {
  entity: PublicContentTranslationEntity;
  entityId: string;
  fields: Record<string, unknown>;
  sourceUpdatedAt?: Date | null;
}) {
  if (!isDatabaseConfigured() || !input.entityId) {
    return;
  }

  const fields = normalizeFields(input.fields);
  if (!Object.keys(fields).length) {
    return;
  }

  const config = await getTranslationConfig().catch(() => null);
  const locale = normalizeLocale(config?.targetLang ?? "en");
  if (locale === "zh-CN") {
    return;
  }

  const sourceHash = hashSource(input.entity, input.entityId, fields);
  await db.publicContentTranslation.upsert({
    where: {
      entity_entityId_locale: {
        entity: input.entity,
        entityId: input.entityId,
        locale
      }
    },
    update: {
      fields: fields as Prisma.InputJsonObject,
      status: TranslationStatus.NOT_TRANSLATED,
      error: null,
      sourceHash,
      sourceUpdatedAt: input.sourceUpdatedAt ?? null,
      progress: 0
    },
    create: {
      entity: input.entity,
      entityId: input.entityId,
      locale,
      fields: fields as Prisma.InputJsonObject,
      status: TranslationStatus.NOT_TRANSLATED,
      sourceHash,
      sourceUpdatedAt: input.sourceUpdatedAt ?? null
    }
  });

  if (!config?.enabled || !config.isConfigured || !config.autoTranslate || !config.saveResult) {
    return;
  }

  const activeJob = await db.publicContentTranslationJob.findFirst({
    where: {
      entity: input.entity,
      entityId: input.entityId,
      locale,
      sourceHash,
      status: { in: ACTIVE_STATUSES }
    },
    select: { id: true }
  });

  if (!activeJob) {
    await db.publicContentTranslationJob.create({
      data: {
        entity: input.entity,
        entityId: input.entityId,
        locale,
        fields: fields as Prisma.InputJsonObject,
        sourceHash,
        progress: 0
      }
    });
  }

  ensurePublicContentTranslationWorker();
}

export function schedulePublicContentTranslation(input: {
  entity: PublicContentTranslationEntity;
  entityId: string;
  fields: Record<string, unknown>;
  sourceUpdatedAt?: Date | null;
}) {
  setTimeout(() => {
    queuePublicContentTranslation(input).catch((error) => {
      console.error("Public content translation queue failed", error);
    });
  }, 0);
}

function publicFieldsFromJson(value: unknown): PublicTranslationFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return normalizeFields(value as Record<string, unknown>);
}

export async function getPublicContentTranslationMap(
  entity: PublicContentTranslationEntity,
  locale: string,
  entityIds: string[]
) {
  const targetLocale = normalizeLocale(locale);
  if (!isDatabaseConfigured() || targetLocale === "zh-CN" || !entityIds.length) {
    return new Map<string, PublicTranslationFields>();
  }

  const rows = await withDatabase(() => db.publicContentTranslation.findMany({
    where: {
      entity,
      entityId: { in: Array.from(new Set(entityIds)) },
      locale: targetLocale,
      status: TranslationStatus.TRANSLATED
    },
    select: {
      entityId: true,
      fields: true
    }
  }), []);

  return new Map(rows.map((row) => [row.entityId, publicFieldsFromJson(row.fields)]));
}

export function translatedField(
  translations: Map<string, PublicTranslationFields>,
  entityId: string,
  field: string,
  fallback: string | null | undefined
) {
  return translations.get(entityId)?.[field] || fallback || "";
}

export async function listPublicContentTranslationJobs(user: CurrentUser, limit = 80) {
  assertPermission(canManageSettings(user), "你没有权限查看公共内容翻译任务。");
  if (!isDatabaseConfigured()) {
    return { jobs: [], error: "DATABASE_URL 未配置，无法读取公共内容翻译任务。" };
  }

  return withDatabase(async () => ({
    jobs: await db.publicContentTranslationJob.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        entity: true,
        entityId: true,
        locale: true,
        status: true,
        progress: true,
        error: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true
      }
    }),
    error: null as string | null
  }), { jobs: [], error: "公共内容翻译任务读取失败。" });
}

export async function retryPublicContentTranslationJob(user: CurrentUser, jobId: string) {
  assertPermission(canManageSettings(user), "你没有权限重试公共内容翻译任务。");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL 未配置。");
  }

  const job = await db.publicContentTranslationJob.findUnique({
    where: { id: jobId },
    select: { id: true, status: true }
  });
  if (!job) {
    throw new Error("公共内容翻译任务不存在。");
  }
  if (ACTIVE_STATUSES.includes(job.status)) {
    ensurePublicContentTranslationWorker();
    return job;
  }

  const updated = await db.publicContentTranslationJob.update({
    where: { id: jobId },
    data: {
      status: PublicContentTranslationJobStatus.QUEUED,
      progress: 0,
      error: null,
      startedAt: null,
      completedAt: null
    }
  });
  ensurePublicContentTranslationWorker();
  return updated;
}

async function resetStaleRunningJobs() {
  const staleBefore = new Date(Date.now() - STALE_RUNNING_MS);
  await db.publicContentTranslationJob.updateMany({
    where: {
      status: PublicContentTranslationJobStatus.RUNNING,
      updatedAt: { lt: staleBefore }
    },
    data: {
      status: PublicContentTranslationJobStatus.QUEUED,
      startedAt: null
    }
  });
}

async function claimNextJob() {
  await resetStaleRunningJobs();
  const queued = await db.publicContentTranslationJob.findFirst({
    where: { status: PublicContentTranslationJobStatus.QUEUED },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });

  if (!queued) {
    return null;
  }

  const claimed = await db.publicContentTranslationJob.updateMany({
    where: { id: queued.id, status: PublicContentTranslationJobStatus.QUEUED },
    data: {
      status: PublicContentTranslationJobStatus.RUNNING,
      progress: 5,
      startedAt: new Date(),
      error: null
    }
  });

  if (!claimed.count) {
    return null;
  }

  return db.publicContentTranslationJob.findUnique({
    where: { id: queued.id },
    select: {
      id: true,
      entity: true,
      entityId: true,
      locale: true,
      fields: true,
      sourceHash: true
    }
  });
}

async function runJob(job: NonNullable<Awaited<ReturnType<typeof claimNextJob>>>) {
  const fields = publicFieldsFromJson(job.fields);
  try {
    const config = await getTranslationConfig();
    const translated = await requestPublicContentTranslation(config, fields, job.locale);

    await db.$transaction([
      db.publicContentTranslation.upsert({
        where: {
          entity_entityId_locale: {
            entity: job.entity,
            entityId: job.entityId,
            locale: job.locale
          }
        },
        update: {
          fields: translated as Prisma.InputJsonObject,
          status: TranslationStatus.TRANSLATED,
          progress: 100,
          error: null,
          sourceHash: job.sourceHash,
          translatedAt: new Date()
        },
        create: {
          entity: job.entity,
          entityId: job.entityId,
          locale: job.locale,
          fields: translated as Prisma.InputJsonObject,
          status: TranslationStatus.TRANSLATED,
          progress: 100,
          sourceHash: job.sourceHash,
          translatedAt: new Date()
        }
      }),
      db.publicContentTranslationJob.update({
        where: { id: job.id },
        data: {
          status: PublicContentTranslationJobStatus.SUCCEEDED,
          progress: 100,
          error: null,
          completedAt: new Date()
        }
      })
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "公共内容翻译失败。";
    await db.$transaction([
      db.publicContentTranslation.updateMany({
        where: {
          entity: job.entity,
          entityId: job.entityId,
          locale: job.locale
        },
        data: {
          status: TranslationStatus.FAILED,
          error: message,
          progress: 0
        }
      }),
      db.publicContentTranslationJob.update({
        where: { id: job.id },
        data: {
          status: PublicContentTranslationJobStatus.FAILED,
          error: message,
          completedAt: new Date()
        }
      })
    ]);
  }
}

export async function drainPublicContentTranslationJobs() {
  if (!isDatabaseConfigured()) {
    return;
  }

  while (true) {
    const job = await claimNextJob();
    if (!job) {
      return;
    }
    await runJob(job);
  }
}

export function ensurePublicContentTranslationWorker() {
  if (workerRunning || !isDatabaseConfigured() || !shouldRunInProcessWorkers()) {
    return;
  }

  workerRunning = true;
  setTimeout(() => {
    drainPublicContentTranslationJobs()
      .catch((error) => console.error("Public content translation worker failed", error))
      .finally(() => {
        workerRunning = false;
      });
  }, 0);
}

export { PublicContentTranslationEntity };
