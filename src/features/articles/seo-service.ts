import { getTranslationConfig, type TranslationConfig } from "@/features/settings/translation-settings";

type SeoInput = {
  title: string;
  summary: string;
  contentHtml: string;
};

type SeoResult = {
  seoTitle: string;
  seoDescription: string;
};

function resolveEndpoint(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    throw new Error("请先配置 AI 接口地址。");
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

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampText(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function assertSeoConfig(config: TranslationConfig) {
  if (!config.baseUrl || !config.apiKey || !config.model) {
    throw new Error("AI 配置不完整：需要接口地址、API Key 和模型名称。");
  }
}

export async function generateArticleSeo(input: SeoInput): Promise<SeoResult> {
  const config = await getTranslationConfig();
  assertSeoConfig(config);

  const payload = {
    model: config.model,
    messages: [
      {
        role: "system",
        content:
          "You generate SEO metadata for blog articles. Return strict JSON only: {\"seoTitle\":\"...\",\"seoDescription\":\"...\"}. Do not use markdown. seoTitle must be <=120 characters. seoDescription must be <=300 characters."
      },
      {
        role: "user",
        content: JSON.stringify({
          title: input.title,
          summary: input.summary,
          contentText: stripHtml(input.contentHtml).slice(0, 6000)
        })
      }
    ],
    temperature: 0.25
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
        throw new Error(`AI SEO 接口返回 ${response.status}${detail}`);
      }

      const result = await response.json();
      const content = result?.choices?.[0]?.message?.content ?? result?.content;
      if (typeof content !== "string") {
        throw new Error("AI SEO 接口未返回文本内容。");
      }

      let parsed: { seoTitle?: unknown; seoDescription?: unknown };
      try {
        parsed = JSON.parse(extractJsonText(content)) as typeof parsed;
      } catch {
        throw new Error("AI SEO 返回内容不是合法 JSON。");
      }

      if (typeof parsed.seoTitle !== "string" || typeof parsed.seoDescription !== "string") {
        throw new Error("AI SEO JSON 缺少 seoTitle 或 seoDescription。");
      }

      return {
        seoTitle: clampText(parsed.seoTitle, 120),
        seoDescription: clampText(parsed.seoDescription, 300)
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("AI SEO 请求超时。");
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

  throw lastError instanceof Error ? lastError : new Error("AI SEO 请求失败。");
}
