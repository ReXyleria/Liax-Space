import type { ArticleLocale } from "../articles/articles.types.js";
import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { logger } from "../common/logger.js";
import { SettingsRepository } from "../settings/SettingsRepository.js";

export type TranslationFields = Record<string, string>;

export type TranslateInput = {
  sourceLocale: ArticleLocale;
  targetLocale: ArticleLocale;
  fields: TranslationFields;
  temperature?: unknown;
};

export type TranslateResult = {
  provider: AiProvider;
  model: string;
  sourceLocale: ArticleLocale;
  targetLocale: ArticleLocale;
  temperature: number;
  fields: TranslationFields;
};

export type TranslationProgressUpdate = {
  completedUnits: number;
  totalUnits: number;
};

export type TranslationRunOptions = {
  onProgress?: (progress: TranslationProgressUpdate) => Promise<void> | void;
};

export type GenerateSeoInput = {
  contentExcerpt?: string;
  locale: ArticleLocale;
  summary?: string;
  title?: string;
};

export type GenerateSeoResult = {
  provider: AiProvider;
  model: string;
  locale: ArticleLocale;
  temperature: number;
  fields: {
    seoDescription: string;
    seoTitle: string;
  };
};

type AiProvider = "deepseek" | "openai" | "ollama";

type AiProviderConfig = {
  apiKey: string | null;
  baseUrl: string;
  chunkConcurrency: number;
  model: string;
  provider: AiProvider;
  temperature: number;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const supportedLocales: ArticleLocale[] = ["zh-CN", "en-US"];
const defaultChunkConcurrency = 1;
const maxChunkConcurrency = 16;
const markdownTranslationChunkLength = 6_000;
const providerDefaults: Record<AiProvider, { baseUrl: string; model: string; requiresApiKey: boolean }> = {
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    requiresApiKey: true
  },
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.1",
    requiresApiKey: false
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    requiresApiKey: true
  }
};

function isArticleLocale(value: unknown): value is ArticleLocale {
  return typeof value === "string" && supportedLocales.includes(value as ArticleLocale);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateFields(value: unknown): TranslationFields {
  if (!isPlainObject(value)) {
    throw new AppError("Translation fields must be an object.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  const fields = Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key.trim().length > 0)
      .map(([key, fieldValue]) => [key, typeof fieldValue === "string" ? fieldValue : ""])
  );

  if (Object.keys(fields).length === 0) {
    throw new AppError("At least one translation field is required.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  return fields;
}

function readTemperature(value: unknown, fallback: number): number {
  const temperature = value === undefined || value === null || value === ""
    ? fallback
    : Number(value);

  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new AppError("Translation temperature must be a number from 0 to 2.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  return temperature;
}

function readSettingString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readSettingTemperature(value: unknown): number {
  return readTemperature(value, 0);
}

function readSettingInteger(value: unknown, fallback: number, min: number, max: number): number {
  const integer = typeof value === "string" ? Number(value.trim()) : value;

  if (typeof integer !== "number" || !Number.isInteger(integer)) {
    return fallback;
  }

  return Math.min(Math.max(integer, min), max);
}

function readProvider(value: unknown): AiProvider {
  return value === "openai" || value === "ollama" || value === "deepseek" ? value : "deepseek";
}

function readBaseUrl(value: unknown, fallback: string): string {
  const baseUrl = readSettingString(value, fallback);

  try {
    return new URL(baseUrl).toString().replace(/\/$/, "");
  } catch {
    throw new AppError("AI base URL must be a valid URL.", {
      code: errorCodes.validationFailed,
      expose: true,
      statusCode: 400
    });
  }
}

function buildAuthHeaders(config: AiProviderConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  return headers;
}

function validateInput(input: unknown, defaultTemperature: number): TranslateInput & { temperature: number } {
  if (!isPlainObject(input)) {
    throw new AppError("Translation request body must be an object.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  if (!isArticleLocale(input.sourceLocale) || !isArticleLocale(input.targetLocale)) {
    throw new AppError("Translation locales must be zh-CN or en-US.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  if (input.sourceLocale === input.targetLocale) {
    throw new AppError("Source locale and target locale must be different.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  return {
    fields: validateFields(input.fields),
    sourceLocale: input.sourceLocale,
    targetLocale: input.targetLocale,
    temperature: readTemperature(input.temperature, defaultTemperature)
  };
}

function validateSeoInput(input: unknown): GenerateSeoInput {
  if (!isPlainObject(input)) {
    throw new AppError("SEO generation request body must be an object.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  if (!isArticleLocale(input.locale)) {
    throw new AppError("SEO generation locale must be zh-CN or en-US.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";
  const summary = typeof input.summary === "string" ? input.summary.trim() : "";
  const contentExcerpt = typeof input.contentExcerpt === "string" ? input.contentExcerpt.trim() : "";

  if (!title && !summary && !contentExcerpt) {
    throw new AppError("SEO generation needs a title, summary, or content excerpt.", {
      code: errorCodes.validationFailed,
      statusCode: 400
    });
  }

  return {
    contentExcerpt,
    locale: input.locale,
    summary,
    title
  };
}

function buildPrompt(input: TranslateInput): string {
  return JSON.stringify({
    instructions: [
      "Translate the provided fields for a bilingual CMS admin experience.",
      "Return valid JSON only with shape {\"fields\": { ... }}.",
      "Preserve object keys exactly.",
      "For a field named slug, return a lowercase ASCII URL slug using hyphens.",
      "Do not add explanations, markdown fences, comments, or extra keys."
    ],
    sourceLocale: input.sourceLocale,
    targetLocale: input.targetLocale,
    fields: input.fields
  });
}

function buildContentChunkPrompt(input: TranslateInput, content: string, index: number, total: number): string {
  return JSON.stringify({
    instructions: [
      "Translate this Markdown segment as part of a longer bilingual CMS article.",
      "Return valid JSON only with shape {\"fields\":{\"content\":\"...\"}}.",
      "Preserve Markdown structure, code fences, inline code, math delimiters, links, image URLs, and front matter syntax.",
      "Do not add explanations, markdown fences around the JSON, comments, or extra keys."
    ],
    sourceLocale: input.sourceLocale,
    targetLocale: input.targetLocale,
    segment: {
      index,
      total
    },
    fields: {
      content
    }
  });
}

function buildSeoPrompt(input: GenerateSeoInput): string {
  return JSON.stringify({
    instructions: [
      "Write SEO metadata for a CMS article.",
      "Use the same language as the provided locale.",
      "Return valid JSON only with shape {\"fields\":{\"seoTitle\":\"...\",\"seoDescription\":\"...\"}}.",
      "Keep seoTitle concise and natural, ideally under 60 characters.",
      "Keep seoDescription natural and useful, ideally under 160 characters.",
      "Do not invent facts that are not present in the input.",
      "Do not add explanations, markdown fences, comments, or extra keys."
    ],
    locale: input.locale,
    source: {
      contentExcerpt: input.contentExcerpt ?? "",
      summary: input.summary ?? "",
      title: input.title ?? ""
    }
  });
}

function isMarkdownFenceBoundary(line: string): boolean {
  return /^\s*(```|~~~)/u.test(line);
}

function splitLongLine(line: string): string[] {
  if (line.length <= markdownTranslationChunkLength) {
    return [line];
  }

  const chunks: string[] = [];

  for (let index = 0; index < line.length; index += markdownTranslationChunkLength) {
    chunks.push(line.slice(index, index + markdownTranslationChunkLength));
  }

  return chunks;
}

function splitMarkdownContent(content: string): string[] {
  if (content.length <= markdownTranslationChunkLength) {
    return [content];
  }

  const chunks: string[] = [];
  const lines = content.split(/(?<=\n)/u);
  let currentChunk = "";
  let isInsideFence = false;

  for (const line of lines) {
    if (!isInsideFence && !currentChunk && line.length > markdownTranslationChunkLength) {
      chunks.push(...splitLongLine(line));
      continue;
    }

    currentChunk += line;

    if (isMarkdownFenceBoundary(line)) {
      isInsideFence = !isInsideFence;
    }

    if (!isInsideFence && currentChunk.length >= markdownTranslationChunkLength) {
      chunks.push(currentChunk);
      currentChunk = "";
    }
  }

  if (currentChunk || chunks.length === 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

async function runWithConcurrency<T>(
  totalItems: number,
  concurrency: number,
  runner: (index: number) => Promise<T>
): Promise<T[]> {
  const results = new Array<T>(totalItems);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(concurrency, 1), Math.max(totalItems, 1));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    for (;;) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= totalItems) {
        return;
      }

      results[index] = await runner(index);
    }
  }));

  return results;
}

function parseTranslatedFields(content: string, originalFields: TranslationFields): TranslationFields {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AppError("Translation provider returned invalid JSON.", {
      code: errorCodes.internalServerError,
      expose: true,
      statusCode: 502
    });
  }

  const fieldSource = isPlainObject(parsed) && isPlainObject(parsed.fields) ? parsed.fields : parsed;

  if (!isPlainObject(fieldSource)) {
    throw new AppError("Translation provider returned an invalid field payload.", {
      code: errorCodes.internalServerError,
      expose: true,
      statusCode: 502
    });
  }

  return Object.fromEntries(
    Object.keys(originalFields).map((key) => {
      const value = fieldSource[key];
      return [key, typeof value === "string" ? value : ""];
    })
  );
}

function parseSeoFields(content: string): GenerateSeoResult["fields"] {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AppError("SEO provider returned invalid JSON.", {
      code: errorCodes.internalServerError,
      expose: true,
      statusCode: 502
    });
  }

  const fieldSource = isPlainObject(parsed) && isPlainObject(parsed.fields) ? parsed.fields : parsed;

  if (!isPlainObject(fieldSource)) {
    throw new AppError("SEO provider returned an invalid field payload.", {
      code: errorCodes.internalServerError,
      expose: true,
      statusCode: 502
    });
  }

  return {
    seoDescription: typeof fieldSource.seoDescription === "string" ? fieldSource.seoDescription.trim() : "",
    seoTitle: typeof fieldSource.seoTitle === "string" ? fieldSource.seoTitle.trim() : ""
  };
}

export class TranslationService {
  constructor(private readonly settingsRepository = new SettingsRepository()) {}

  private async readAiProviderConfig(): Promise<AiProviderConfig> {
    const settings = await this.settingsRepository.getSiteSettings();
    const provider = readProvider(settings["ai.provider"]);
    const defaults = providerDefaults[provider];
    const apiKey = readSettingString(settings["ai.apiKey"], "");
    const baseUrl = readBaseUrl(settings["ai.baseUrl"], defaults.baseUrl);
    const chunkConcurrency = readSettingInteger(
      settings["ai.chunkConcurrency"],
      defaultChunkConcurrency,
      defaultChunkConcurrency,
      maxChunkConcurrency
    );
    const model = readSettingString(settings["ai.model"], defaults.model);
    const temperature = readSettingTemperature(settings["ai.translationTemperature"]);

    if (defaults.requiresApiKey && !apiKey) {
      throw new AppError("AI translation is not configured. Set the API key in site settings.", {
        code: errorCodes.validationFailed,
        expose: true,
        statusCode: 503
      });
    }

    return {
      baseUrl,
      chunkConcurrency,
      model,
      apiKey: apiKey || null,
      provider,
      temperature
    };
  }

  private async requestJsonContent(input: {
    config: AiProviderConfig;
    logLabel: string;
    prompt: string;
    systemMessage: string;
    temperature: number;
  }): Promise<string> {
    const response = await fetch(`${input.config.baseUrl}/chat/completions`, {
      body: JSON.stringify({
        messages: [
          {
            content: input.systemMessage,
            role: "system"
          },
          {
            content: input.prompt,
            role: "user"
          }
        ],
        model: input.config.model,
        response_format: { type: "json_object" },
        temperature: input.temperature
      }),
      headers: {
        ...buildAuthHeaders(input.config)
      },
      method: "POST"
    });

    if (!response.ok) {
      logger.warn(`${input.logLabel} provider request failed`, {
        provider: input.config.provider,
        status: response.status
      });
      throw new AppError(`AI ${input.logLabel} request failed.`, {
        code: errorCodes.internalServerError,
        expose: true,
        statusCode: 502
      });
    }

    const payload = await response.json() as ChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new AppError(`AI ${input.logLabel} response did not include content.`, {
        code: errorCodes.internalServerError,
        expose: true,
        statusCode: 502
      });
    }

    return content;
  }

  private async translateFieldBatch(config: AiProviderConfig, request: TranslateInput & { temperature: number }): Promise<TranslationFields> {
    const content = await this.requestJsonContent({
      config,
      logLabel: "translation",
      prompt: buildPrompt(request),
      systemMessage: "You are a precise bilingual CMS translation engine. Return JSON only.",
      temperature: request.temperature
    });

    return parseTranslatedFields(content, request.fields);
  }

  private async translateContentChunk(
    config: AiProviderConfig,
    request: TranslateInput & { temperature: number },
    contentChunk: string,
    index: number,
    total: number
  ): Promise<string> {
    const content = await this.requestJsonContent({
      config,
      logLabel: "translation",
      prompt: buildContentChunkPrompt(request, contentChunk, index + 1, total),
      systemMessage: "You are a precise bilingual Markdown translation engine. Return JSON only.",
      temperature: request.temperature
    });
    const fields = parseTranslatedFields(content, { content: contentChunk });

    return fields.content ?? "";
  }

  private async translateFields(
    config: AiProviderConfig,
    request: TranslateInput & { temperature: number },
    options: TranslationRunOptions
  ): Promise<TranslationFields> {
    const contentValue = request.fields.content;
    const nonContentFields = Object.fromEntries(
      Object.entries(request.fields).filter(([key]) => key !== "content")
    );
    const contentChunks = typeof contentValue === "string" ? splitMarkdownContent(contentValue) : [];
    const hasNonContentFields = Object.keys(nonContentFields).length > 0;
    const totalUnits = contentChunks.length + (hasNonContentFields ? 1 : 0);
    let completedUnits = 0;

    await options.onProgress?.({ completedUnits, totalUnits });

    const translatedFields: TranslationFields = {};

    if (hasNonContentFields) {
      Object.assign(translatedFields, await this.translateFieldBatch(config, {
        ...request,
        fields: nonContentFields
      }));
      completedUnits += 1;
      await options.onProgress?.({ completedUnits, totalUnits });
    }

    if (contentChunks.length > 0) {
      const translatedChunks = await runWithConcurrency(
        contentChunks.length,
        config.chunkConcurrency,
        async (index) => {
          const translatedChunk = await this.translateContentChunk(config, request, contentChunks[index], index, contentChunks.length);
          completedUnits += 1;
          await options.onProgress?.({ completedUnits, totalUnits });

          return translatedChunk;
        }
      );

      translatedFields.content = translatedChunks.join("");
    }

    return translatedFields;
  }

  async translate(input: unknown, options: TranslationRunOptions = {}): Promise<TranslateResult> {
    const config = await this.readAiProviderConfig();
    const request = validateInput(input, config.temperature);

    return {
      fields: await this.translateFields(config, request, options),
      model: config.model,
      provider: config.provider,
      sourceLocale: request.sourceLocale,
      targetLocale: request.targetLocale,
      temperature: request.temperature
    };
  }

  async generateSeo(input: unknown): Promise<GenerateSeoResult> {
    const config = await this.readAiProviderConfig();
    const request = validateSeoInput(input);
    const content = await this.requestJsonContent({
      config,
      logLabel: "SEO generation",
      prompt: buildSeoPrompt(request),
      systemMessage: "You are a precise SEO metadata writer for a bilingual CMS. Return JSON only.",
      temperature: config.temperature
    });

    return {
      fields: parseSeoFields(content),
      locale: request.locale,
      model: config.model,
      provider: config.provider,
      temperature: config.temperature
    };
  }
}
