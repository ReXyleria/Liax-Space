import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { SettingsRepository } from "../settings/SettingsRepository.js";
import { SeoService } from "./SeoService.js";
import {
  SeoPushRepository,
  type SeoPushProvider,
  type SeoPushSubmission
} from "./SeoPushRepository.js";

export type SeoPushSubmitResult = {
  submissions: SeoPushSubmission[];
};

type ProviderConfig = {
  enabled: boolean;
  key: string;
  site: string;
  url: string;
};

const providerOrder: SeoPushProvider[] = ["baidu", "indexnow", "google"];

function validationError(message: string): AppError {
  return new AppError(message, {
    code: errorCodes.validationFailed,
    statusCode: 400
  });
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function normalizeUrlList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => readString(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(/\r?\n|,/u).map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function assertSafeUrls(urls: string[]): string[] {
  const normalizedUrls = [...new Set(urls)];

  if (normalizedUrls.length === 0) {
    validationError("At least one URL is required.");
  }

  for (const url of normalizedUrls) {
    try {
      const parsed = new URL(url);

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        validationError(`URL must use http or https: ${url}`);
      }
    } catch {
      validationError(`Invalid URL: ${url}`);
    }
  }

  return normalizedUrls.slice(0, 200);
}

async function readResponseText(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, 2000);
}

export class SeoPushService {
  constructor(
    private readonly settingsRepository = new SettingsRepository(),
    private readonly seoService = new SeoService(),
    private readonly pushRepository = new SeoPushRepository()
  ) {}

  async listRecentSubmissions(): Promise<SeoPushSubmission[]> {
    return this.pushRepository.listRecent();
  }

  async submit(input: { providers?: unknown; urls?: unknown } = {}): Promise<SeoPushSubmitResult> {
    const settings = await this.settingsRepository.getSiteSettings();
    const urls = assertSafeUrls(input.urls === undefined ? await this.listDefaultUrls() : normalizeUrlList(input.urls));
    const selectedProviders = this.normalizeProviders(input.providers);
    const submissions: SeoPushSubmission[] = [];

    for (const provider of selectedProviders) {
      submissions.push(await this.submitProvider(provider, settings, urls));
    }

    return { submissions };
  }

  private normalizeProviders(value: unknown): SeoPushProvider[] {
    if (value === undefined || value === null || value === "") {
      return providerOrder;
    }

    const rawProviders = Array.isArray(value) ? value : [value];
    const providers = rawProviders.map((item) => readString(item)).filter(Boolean);

    for (const provider of providers) {
      if (!providerOrder.includes(provider as SeoPushProvider)) {
        validationError(`Unknown SEO push provider: ${provider}`);
      }
    }

    return [...new Set(providers as SeoPushProvider[])];
  }

  private readProviderConfig(settings: Record<string, unknown>, provider: SeoPushProvider): ProviderConfig {
    return {
      enabled: readBoolean(settings[`seoPush.${provider}.enabled`]),
      key: readString(settings[`seoPush.${provider}.key`]),
      site: readString(settings[`seoPush.${provider}.site`]),
      url: readString(settings[`seoPush.${provider}.url`])
    };
  }

  private async listDefaultUrls(): Promise<string[]> {
    const articles = await this.seoService.listPublishedArticles();
    const urls = [
      this.seoService.buildSitemapIndexUrl(),
      this.seoService.buildLocaleHomeUrl("zh-CN"),
      this.seoService.buildLocaleHomeUrl("en-US"),
      this.seoService.buildLocaleSitemapUrl("zh-CN"),
      this.seoService.buildLocaleSitemapUrl("en-US"),
      ...articles.map((article) => this.seoService.buildArticleUrl(article.locale, article.slug))
    ];

    return urls;
  }

  private async submitProvider(provider: SeoPushProvider, settings: Record<string, unknown>, urls: string[]): Promise<SeoPushSubmission> {
    const config = this.readProviderConfig(settings, provider);

    if (!config.enabled) {
      return this.pushRepository.create({
        message: "Provider is disabled.",
        provider,
        status: "skipped",
        submittedCount: 0,
        urls
      });
    }

    if (provider === "baidu") {
      return this.submitBaidu(config, urls);
    }

    if (provider === "indexnow") {
      return this.submitIndexNow(config, urls);
    }

    return this.submitGoogle(config, urls);
  }

  private async submitBaidu(config: ProviderConfig, urls: string[]): Promise<SeoPushSubmission> {
    const endpoint = config.url || (config.site && config.key ? `https://data.zz.baidu.com/urls?site=${encodeURIComponent(config.site)}&token=${encodeURIComponent(config.key)}` : "");

    if (!endpoint) {
      return this.pushRepository.create({
        message: "Baidu push requires endpoint URL or site/token.",
        provider: "baidu",
        status: "skipped",
        submittedCount: 0,
        urls
      });
    }

    return this.postPlainText("baidu", endpoint, urls);
  }

  private async submitIndexNow(config: ProviderConfig, urls: string[]): Promise<SeoPushSubmission> {
    if (!config.key) {
      return this.pushRepository.create({
        message: "IndexNow push requires a key.",
        provider: "indexnow",
        status: "skipped",
        submittedCount: 0,
        urls
      });
    }

    const endpoint = config.url || "https://api.indexnow.org/indexnow";
    const host = config.site || new URL(urls[0]).host;

    return this.postJson("indexnow", endpoint, {
      host,
      key: config.key,
      keyLocation: `https://${host}/${config.key}.txt`,
      urlList: urls
    }, urls);
  }

  private async submitGoogle(config: ProviderConfig, urls: string[]): Promise<SeoPushSubmission> {
    const endpoint = config.url || "https://indexing.googleapis.com/v3/urlNotifications:publish";

    if (!config.key) {
      return this.pushRepository.create({
        message: "Google Indexing API requires an OAuth access token in the key field.",
        provider: "google",
        status: "skipped",
        submittedCount: 0,
        urls
      });
    }

    const submissions: SeoPushSubmission[] = [];

    for (const url of urls.slice(0, 20)) {
      submissions.push(await this.postJson("google", endpoint, { type: "URL_UPDATED", url }, [url], {
        Authorization: `Bearer ${config.key}`
      }));
    }

    const failed = submissions.find((submission) => submission.status === "failed");

    return this.pushRepository.create({
      message: failed ? "One or more Google URL submissions failed." : `Google accepted ${submissions.length} URL submission requests.`,
      provider: "google",
      requestUrl: endpoint,
      status: failed ? "failed" : "success",
      submittedCount: submissions.reduce((sum, submission) => sum + submission.submittedCount, 0),
      urls: urls.slice(0, 20)
    });
  }

  private async postPlainText(provider: SeoPushProvider, endpoint: string, urls: string[]): Promise<SeoPushSubmission> {
    try {
      const response = await fetch(endpoint, {
        body: urls.join("\n"),
        headers: { "Content-Type": "text/plain" },
        method: "POST"
      });
      const message = await readResponseText(response);

      return this.pushRepository.create({
        message,
        provider,
        requestUrl: endpoint,
        status: response.ok ? "success" : "failed",
        statusCode: response.status,
        submittedCount: response.ok ? urls.length : 0,
        urls
      });
    } catch (error) {
      return this.pushRepository.create({
        message: error instanceof Error ? error.message : "Unknown push failure.",
        provider,
        requestUrl: endpoint,
        status: "failed",
        submittedCount: 0,
        urls
      });
    }
  }

  private async postJson(
    provider: SeoPushProvider,
    endpoint: string,
    body: unknown,
    urls: string[],
    headers: Record<string, string> = {}
  ): Promise<SeoPushSubmission> {
    try {
      const response = await fetch(endpoint, {
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json", ...headers },
        method: "POST"
      });
      const message = await readResponseText(response);

      return this.pushRepository.create({
        message,
        provider,
        requestUrl: endpoint,
        status: response.ok ? "success" : "failed",
        statusCode: response.status,
        submittedCount: response.ok ? urls.length : 0,
        urls
      });
    } catch (error) {
      return this.pushRepository.create({
        message: error instanceof Error ? error.message : "Unknown push failure.",
        provider,
        requestUrl: endpoint,
        status: "failed",
        submittedCount: 0,
        urls
      });
    }
  }
}
