import { createHash, createSign } from "node:crypto";
import {
  ArticleStatus,
  SettingType,
  SitePushAction,
  SitePushProvider,
  SitePushStatus
} from "@prisma/client";
import { z } from "zod";
import { db, isDatabaseConfigured } from "@/lib/db";
import { getIndexableArticleLocaleUrls } from "@/features/articles/indexing";
import { assertPermission, canManageSettings } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/auth";

const SETTING_KEYS = {
  baiduEnabled: "sitePush.baidu.enabled",
  baiduSite: "sitePush.baidu.site",
  baiduToken: "sitePush.baidu.token",
  baiduEndpoint: "sitePush.baidu.endpoint",
  bingEnabled: "sitePush.bing.enabled",
  bingKey: "sitePush.bing.key",
  bingKeyLocation: "sitePush.bing.keyLocation",
  bingEndpoint: "sitePush.bing.endpoint",
  googleEnabled: "sitePush.google.enabled",
  googlePropertyUrl: "sitePush.google.propertyUrl",
  googleServiceAccount: "sitePush.google.serviceAccount"
} as const;

const DEFAULT_BING_ENDPOINT = "https://api.indexnow.org/indexnow";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/indexing";
const GOOGLE_PUBLISH_ENDPOINT = "https://indexing.googleapis.com/v3/urlNotifications:publish";
const BAIDU_BATCH_SIZE = 2000;
const INDEXNOW_BATCH_SIZE = 10000;
const GOOGLE_BATCH_SIZE = 10;
const GOOGLE_CONCURRENCY = 3;
const RECENT_SUCCESS_DEDUP_MS = 24 * 60 * 60 * 1000;

type GoogleServiceAccount = {
  client_email?: string;
  private_key?: string;
  project_id?: string;
  token_uri?: string;
};

type InternalSitePushSettings = {
  siteUrl: string;
  siteHost: string;
  baidu: { enabled: boolean; site: string; token: string; endpoint: string };
  bing: { enabled: boolean; key: string; keyLocation: string; endpoint: string };
  google: { enabled: boolean; propertyUrl: string; serviceAccount: string };
};

export type SitePushSettingsView = {
  siteUrl: string;
  siteHost: string;
  baidu: {
    enabled: boolean;
    configured: boolean;
    site: string;
    hasToken: boolean;
    tokenMasked: string;
    endpoint: string;
  };
  bing: {
    enabled: boolean;
    configured: boolean;
    hasKey: boolean;
    keyMasked: string;
    keyLocation: string;
    endpoint: string;
  };
  google: {
    enabled: boolean;
    configured: boolean;
    propertyUrl: string;
    hasServiceAccount: boolean;
    serviceAccountMasked: string;
    clientEmail: string;
    projectId: string;
  };
};

type PushResult = {
  status: SitePushStatus;
  httpStatus?: number;
  responseBody?: string;
  error?: string;
};

export type SitePushSubmissionSummary = {
  urls: number;
  providers: number;
  records: number;
  success: number;
  failed: number;
  skipped: number;
};

type ProviderPushSummary = Omit<SitePushSubmissionSummary, "urls" | "providers">;

export class SitePushValidationError extends Error {
  fieldErrors: Record<string, string[]>;

  constructor(message: string, fieldErrors: Record<string, string[]>) {
    super(message);
    this.name = "SitePushValidationError";
    this.fieldErrors = fieldErrors;
  }
}

function parseBoolean(value: string | undefined) {
  return value === "true" || value === "on" || value === "1";
}

function maskSecret(value: string) {
  if (!value) return "";
  if (value.length <= 8) return "********";
  return `${value.slice(0, 4)}********${value.slice(-4)}`;
}

function parseUrlLike(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

function normalizeSiteUrl(value: string) {
  const url = parseUrlLike(value);
  return url?.origin.replace(/\/+$/, "") || "";
}

function getHostFromUrl(value: string) {
  return parseUrlLike(value)?.host || "";
}

function normalizeBaiduSite(value: string) {
  const url = parseUrlLike(value);
  if (url) {
    return url.host;
  }

  return value.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
}

function normalizeUrl(value: string) {
  const url = parseUrlLike(value);
  return url?.toString().replace(/\/+$/, "") || "";
}

function buildDefaultIndexNowKeyLocation(siteUrl: string) {
  return siteUrl ? `${siteUrl}/indexnow-key.txt` : "";
}

function limitBody(value: string) {
  return value.length > 4000 ? value.slice(0, 4000) : value;
}

function urlHash(url: string) {
  return createHash("sha256").update(url).digest("hex");
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function emptyProviderSummary(): ProviderPushSummary {
  return { records: 0, success: 0, failed: 0, skipped: 0 };
}

function emptySubmissionSummary(urls: number, providers: number): SitePushSubmissionSummary {
  return { urls, providers, ...emptyProviderSummary() };
}

function addProviderResult(summary: ProviderPushSummary, status: SitePushStatus, count: number) {
  summary.records += count;
  if (status === SitePushStatus.SUCCESS) {
    summary.success += count;
  } else if (status === SitePushStatus.FAILED) {
    summary.failed += count;
  } else if (status === SitePushStatus.SKIPPED) {
    summary.skipped += count;
  }
}

function base64Url(value: Buffer | string) {
  return Buffer.from(value).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signJwt(payload: Record<string, unknown>, privateKey: string) {
  const header = { alg: "RS256", typ: "JWT" };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${base64Url(signer.sign(privateKey.replace(/\\n/g, "\n")))}`;
}

function parseGoogleServiceAccount(value: string): GoogleServiceAccount | null {
  if (!value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as GoogleServiceAccount;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function getGoogleAccountInfo(value: string) {
  const account = parseGoogleServiceAccount(value);
  return {
    clientEmail: account?.client_email ?? "",
    projectId: account?.project_id ?? "",
    valid: Boolean(account?.client_email && account.private_key && account.token_uri)
  };
}

function isBaiduConfigured(settings: InternalSitePushSettings) {
  return Boolean(settings.baidu.site && settings.baidu.token);
}

function isBingConfigured(settings: InternalSitePushSettings) {
  return Boolean(settings.siteHost && settings.bing.key && settings.bing.keyLocation && settings.bing.endpoint);
}

function isGoogleConfigured(settings: InternalSitePushSettings) {
  return Boolean(settings.google.propertyUrl && getGoogleAccountInfo(settings.google.serviceAccount).valid);
}

function isProviderAvailable(settings: InternalSitePushSettings, provider: SitePushProvider) {
  if (provider === SitePushProvider.BAIDU) {
    return settings.baidu.enabled && isBaiduConfigured(settings);
  }
  if (provider === SitePushProvider.BING) {
    return settings.bing.enabled && isBingConfigured(settings);
  }
  return settings.google.enabled && isGoogleConfigured(settings);
}

function getEnabledProviders(settings: InternalSitePushSettings) {
  return [SitePushProvider.BAIDU, SitePushProvider.BING, SitePushProvider.GOOGLE].filter((provider) =>
    isProviderAvailable(settings, provider)
  );
}

function toView(settings: InternalSitePushSettings): SitePushSettingsView {
  const googleInfo = getGoogleAccountInfo(settings.google.serviceAccount);

  return {
    siteUrl: settings.siteUrl,
    siteHost: settings.siteHost,
    baidu: {
      enabled: settings.baidu.enabled,
      configured: isBaiduConfigured(settings),
      site: settings.baidu.site,
      hasToken: Boolean(settings.baidu.token),
      tokenMasked: maskSecret(settings.baidu.token),
      endpoint: settings.baidu.endpoint
    },
    bing: {
      enabled: settings.bing.enabled,
      configured: isBingConfigured(settings),
      hasKey: Boolean(settings.bing.key),
      keyMasked: maskSecret(settings.bing.key),
      keyLocation: settings.bing.keyLocation,
      endpoint: settings.bing.endpoint
    },
    google: {
      enabled: settings.google.enabled,
      configured: isGoogleConfigured(settings),
      propertyUrl: settings.google.propertyUrl,
      hasServiceAccount: Boolean(settings.google.serviceAccount),
      serviceAccountMasked: settings.google.serviceAccount ? "Saved Service Account JSON" : "",
      clientEmail: googleInfo.clientEmail,
      projectId: googleInfo.projectId
    }
  };
}

async function loadInternalSettings(): Promise<InternalSitePushSettings> {
  const rows = await db.setting.findMany({
    where: { key: { in: ["site.url", ...Object.values(SETTING_KEYS)] } },
    select: { key: true, value: true }
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const siteUrl = normalizeSiteUrl(map.get("site.url") ?? "http://localhost:3000") || "http://localhost:3000";
  const siteHost = getHostFromUrl(siteUrl);
  const bingKey = map.get(SETTING_KEYS.bingKey) ?? "";
  const keyLocation = map.get(SETTING_KEYS.bingKeyLocation) || buildDefaultIndexNowKeyLocation(siteUrl);

  return {
    siteUrl,
    siteHost,
    baidu: {
      enabled: parseBoolean(map.get(SETTING_KEYS.baiduEnabled)),
      site: normalizeBaiduSite(map.get(SETTING_KEYS.baiduSite) ?? ""),
      token: map.get(SETTING_KEYS.baiduToken) ?? "",
      endpoint: map.get(SETTING_KEYS.baiduEndpoint) ?? ""
    },
    bing: {
      enabled: parseBoolean(map.get(SETTING_KEYS.bingEnabled)),
      key: bingKey,
      keyLocation,
      endpoint: map.get(SETTING_KEYS.bingEndpoint) || DEFAULT_BING_ENDPOINT
    },
    google: {
      enabled: parseBoolean(map.get(SETTING_KEYS.googleEnabled)),
      propertyUrl: normalizeUrl(map.get(SETTING_KEYS.googlePropertyUrl) ?? siteUrl),
      serviceAccount: map.get(SETTING_KEYS.googleServiceAccount) ?? ""
    }
  };
}

async function defaultSettings(): Promise<InternalSitePushSettings> {
  const siteUrl = "http://localhost:3000";
  return {
    siteUrl,
    siteHost: getHostFromUrl(siteUrl),
    baidu: { enabled: false, site: "", token: "", endpoint: "" },
    bing: {
      enabled: false,
      key: "",
      keyLocation: buildDefaultIndexNowKeyLocation(siteUrl),
      endpoint: DEFAULT_BING_ENDPOINT
    },
    google: { enabled: false, propertyUrl: siteUrl, serviceAccount: "" }
  };
}

export async function getSitePushSettings(user: CurrentUser) {
  assertPermission(canManageSettings(user), "You do not have permission to manage site push settings.");
  if (!isDatabaseConfigured()) {
    return { settings: toView(await defaultSettings()), error: "DATABASE_URL is not configured." };
  }
  return { settings: toView(await loadInternalSettings()), error: null };
}

function pickSecret(input: string, existing: string) {
  const value = input.trim();
  if (!value || value.includes("****") || value.toLowerCase().includes("saved service account")) {
    return existing;
  }
  return value;
}

const sitePushSettingsSchema = z
  .object({
    baiduEnabled: z.boolean(),
    baiduSite: z.string(),
    baiduToken: z.string(),
    baiduEndpoint: z.string(),
    bingEnabled: z.boolean(),
    bingKey: z.string(),
    bingKeyLocation: z.string(),
    bingEndpoint: z.string(),
    googleEnabled: z.boolean(),
    googlePropertyUrl: z.string(),
    googleServiceAccount: z.string()
  })
  .superRefine((value, ctx) => {
    if (value.baiduEnabled) {
      if (!value.baiduSite) {
        ctx.addIssue({ code: "custom", path: ["baiduSite"], message: "Baidu site is required when enabled." });
      }
      if (!value.baiduToken) {
        ctx.addIssue({ code: "custom", path: ["baiduToken"], message: "Baidu token is required when enabled." });
      }
    }

    if (value.baiduEndpoint && !parseUrlLike(value.baiduEndpoint)) {
      ctx.addIssue({ code: "custom", path: ["baiduEndpoint"], message: "Baidu endpoint must be a valid URL." });
    }

    if (value.bingEnabled) {
      if (!/^[A-Za-z0-9-]{8,128}$/.test(value.bingKey)) {
        ctx.addIssue({
          code: "custom",
          path: ["bingKey"],
          message: "IndexNow key must be 8-128 letters, numbers, or dashes."
        });
      }
      if (!parseUrlLike(value.bingKeyLocation)) {
        ctx.addIssue({ code: "custom", path: ["bingKeyLocation"], message: "IndexNow key location is required." });
      }
      if (!parseUrlLike(value.bingEndpoint)) {
        ctx.addIssue({ code: "custom", path: ["bingEndpoint"], message: "IndexNow endpoint must be a valid URL." });
      }
    }

    if (value.googleEnabled) {
      if (!parseUrlLike(value.googlePropertyUrl)) {
        ctx.addIssue({
          code: "custom",
          path: ["googlePropertyUrl"],
          message: "Google Search Console property URL is required when enabled."
        });
      }
      const account = parseGoogleServiceAccount(value.googleServiceAccount);
      if (!account) {
        ctx.addIssue({
          code: "custom",
          path: ["googleServiceAccount"],
          message: "Google Service Account JSON is required when enabled."
        });
      } else {
        if (!account.client_email) {
          ctx.addIssue({ code: "custom", path: ["googleServiceAccount"], message: "Service Account JSON is missing client_email." });
        }
        if (!account.private_key) {
          ctx.addIssue({ code: "custom", path: ["googleServiceAccount"], message: "Service Account JSON is missing private_key." });
        }
        if (!account.token_uri) {
          ctx.addIssue({ code: "custom", path: ["googleServiceAccount"], message: "Service Account JSON is missing token_uri." });
        }
      }
    } else if (value.googleServiceAccount && !parseGoogleServiceAccount(value.googleServiceAccount)) {
      ctx.addIssue({
        code: "custom",
        path: ["googleServiceAccount"],
        message: "Service Account JSON is invalid."
      });
    }
  });

function buildSettingsInput(formData: FormData, existing: InternalSitePushSettings) {
  const baiduToken = pickSecret(String(formData.get("baiduToken") ?? ""), existing.baidu.token);
  const bingKey = pickSecret(String(formData.get("bingKey") ?? ""), existing.bing.key);
  const googleServiceAccount = pickSecret(
    String(formData.get("googleServiceAccount") ?? ""),
    existing.google.serviceAccount
  );
  const siteUrl = existing.siteUrl;

  return {
    baiduEnabled: formData.get("baiduEnabled") === "on",
    baiduSite: normalizeBaiduSite(String(formData.get("baiduSite") ?? "")),
    baiduToken,
    baiduEndpoint: String(formData.get("baiduEndpoint") ?? "").trim(),
    bingEnabled: formData.get("bingEnabled") === "on",
    bingKey,
    bingKeyLocation: String(formData.get("bingKeyLocation") ?? "").trim() || buildDefaultIndexNowKeyLocation(siteUrl),
    bingEndpoint: String(formData.get("bingEndpoint") ?? DEFAULT_BING_ENDPOINT).trim() || DEFAULT_BING_ENDPOINT,
    googleEnabled: formData.get("googleEnabled") === "on",
    googlePropertyUrl: normalizeUrl(String(formData.get("googlePropertyUrl") ?? (existing.google.propertyUrl || siteUrl))),
    googleServiceAccount
  };
}

export async function saveSitePushSettings(user: CurrentUser, formData: FormData) {
  assertPermission(canManageSettings(user), "You do not have permission to manage site push settings.");
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const existing = await loadInternalSettings();
  const input = buildSettingsInput(formData, existing);
  const parsed = sitePushSettingsSchema.safeParse(input);
  if (!parsed.success) {
    throw new SitePushValidationError("Please fix the highlighted site push settings.", parsed.error.flatten().fieldErrors);
  }

  const values = parsed.data;
  const updates: Array<{ key: string; value: string; type: SettingType }> = [
    { key: SETTING_KEYS.baiduEnabled, value: String(values.baiduEnabled), type: SettingType.BOOLEAN },
    { key: SETTING_KEYS.baiduSite, value: values.baiduSite, type: SettingType.TEXT },
    { key: SETTING_KEYS.baiduEndpoint, value: values.baiduEndpoint, type: SettingType.TEXT },
    { key: SETTING_KEYS.bingEnabled, value: String(values.bingEnabled), type: SettingType.BOOLEAN },
    { key: SETTING_KEYS.bingKeyLocation, value: values.bingKeyLocation, type: SettingType.TEXT },
    { key: SETTING_KEYS.bingEndpoint, value: values.bingEndpoint, type: SettingType.TEXT },
    { key: SETTING_KEYS.googleEnabled, value: String(values.googleEnabled), type: SettingType.BOOLEAN },
    { key: SETTING_KEYS.googlePropertyUrl, value: values.googlePropertyUrl, type: SettingType.TEXT }
  ];

  if (values.baiduToken) updates.push({ key: SETTING_KEYS.baiduToken, value: values.baiduToken, type: SettingType.PASSWORD });
  if (values.bingKey) updates.push({ key: SETTING_KEYS.bingKey, value: values.bingKey, type: SettingType.PASSWORD });
  if (values.googleServiceAccount) {
    updates.push({
      key: SETTING_KEYS.googleServiceAccount,
      value: values.googleServiceAccount,
      type: SettingType.PASSWORD
    });
  }

  await db.$transaction(
    updates.map((setting) =>
      db.setting.upsert({
        where: { key: setting.key },
        update: { value: setting.value, group: "sitePush", type: setting.type },
        create: { key: setting.key, value: setting.value, group: "sitePush", type: setting.type }
      })
    )
  );
}

export async function listSitePushRecords(user: CurrentUser, take = 60) {
  assertPermission(canManageSettings(user), "You do not have permission to view site push records.");
  if (!isDatabaseConfigured()) {
    return { records: [], error: "DATABASE_URL is not configured." };
  }

  const records = await db.sitePushRecord.findMany({
    orderBy: { createdAt: "desc" },
    take
  });
  return { records, error: null };
}

async function createRecord(provider: SitePushProvider, url: string, action: SitePushAction, result: PushResult) {
  return db.sitePushRecord.create({
    data: {
      provider,
      url,
      urlHash: urlHash(url),
      action,
      status: result.status,
      httpStatus: result.httpStatus,
      responseBody: result.responseBody ? limitBody(result.responseBody) : null,
      error: result.error ? limitBody(result.error) : null,
      submittedAt: result.status === SitePushStatus.SKIPPED ? null : new Date()
    }
  });
}

async function filterRecentlySuccessfulUrls(provider: SitePushProvider, urls: string[]) {
  const hashesByUrl = new Map(urls.map((url) => [url, urlHash(url)]));
  const recentCutoff = new Date(Date.now() - RECENT_SUCCESS_DEDUP_MS);
  const records = await db.sitePushRecord.findMany({
    where: {
      provider,
      urlHash: { in: Array.from(new Set(hashesByUrl.values())) },
      status: SitePushStatus.SUCCESS,
      submittedAt: { gte: recentCutoff }
    },
    select: { urlHash: true }
  });
  const pushedHashes = new Set(records.flatMap((record) => record.urlHash ? [record.urlHash] : []));
  return urls.filter((url) => !pushedHashes.has(hashesByUrl.get(url) ?? ""));
}

function buildBaiduEndpoint(settings: InternalSitePushSettings) {
  if (settings.baidu.endpoint) return settings.baidu.endpoint;
  if (!settings.baidu.site || !settings.baidu.token) return "";
  return `https://data.zz.baidu.com/urls?site=${encodeURIComponent(settings.baidu.site)}&token=${encodeURIComponent(settings.baidu.token)}`;
}

async function pushBaidu(settings: InternalSitePushSettings, urls: string[]): Promise<PushResult> {
  const endpoint = buildBaiduEndpoint(settings);
  if (!isProviderAvailable(settings, SitePushProvider.BAIDU) || !endpoint) {
    return { status: SitePushStatus.SKIPPED, error: "Baidu push is not configured." };
  }
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: urls.join("\n")
  });
  const body = await response.text().catch(() => "");
  return {
    status: response.ok ? SitePushStatus.SUCCESS : SitePushStatus.FAILED,
    httpStatus: response.status,
    responseBody: body
  };
}

async function pushBing(settings: InternalSitePushSettings, urls: string[]): Promise<PushResult> {
  if (!isProviderAvailable(settings, SitePushProvider.BING)) {
    return { status: SitePushStatus.SKIPPED, error: "IndexNow push is not configured." };
  }
  const response = await fetch(settings.bing.endpoint || DEFAULT_BING_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      host: settings.siteHost,
      key: settings.bing.key,
      keyLocation: settings.bing.keyLocation,
      urlList: urls
    })
  });
  const body = await response.text().catch(() => "");
  return {
    status: response.status === 200 || response.status === 202 ? SitePushStatus.SUCCESS : SitePushStatus.FAILED,
    httpStatus: response.status,
    responseBody: body
  };
}

async function getGoogleAccessToken(serviceAccountJson: string) {
  const account = parseGoogleServiceAccount(serviceAccountJson);
  if (!account?.client_email || !account.private_key || !account.token_uri) {
    throw new Error("Google Service Account JSON is missing client_email, private_key, or token_uri.");
  }
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    {
      iss: account.client_email,
      scope: GOOGLE_SCOPE,
      aud: account.token_uri,
      iat: now,
      exp: now + 3600
    },
    account.private_key
  );
  const response = await fetch(account.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || typeof body?.access_token !== "string") {
    throw new Error(`Google token request failed: ${response.status}`);
  }
  return body.access_token as string;
}

async function pushGoogle(settings: InternalSitePushSettings, urls: string[]): Promise<PushResult> {
  if (!isProviderAvailable(settings, SitePushProvider.GOOGLE)) {
    return { status: SitePushStatus.SKIPPED, error: "Google Indexing API is not configured." };
  }
  const accessToken = await getGoogleAccessToken(settings.google.serviceAccount);
  const responses: string[] = [];
  let finalStatus: SitePushStatus = SitePushStatus.SUCCESS;
  let finalHttpStatus = 200;

  for (let index = 0; index < urls.length; index += GOOGLE_CONCURRENCY) {
    const batch = urls.slice(index, index + GOOGLE_CONCURRENCY);
    const batchResults = await Promise.all(batch.map(async (url) => {
      const response = await fetch(GOOGLE_PUBLISH_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ url, type: "URL_UPDATED" })
      });
      const body = await response.text().catch(() => "");
      return { url, ok: response.ok, status: response.status, body };
    }));

    for (const result of batchResults) {
      responses.push(`${result.url}: ${result.body}`);
      finalHttpStatus = result.status;
      if (!result.ok) {
        finalStatus = SitePushStatus.FAILED;
      }
    }
  }

  return {
    status: finalStatus,
    httpStatus: finalHttpStatus,
    responseBody: responses.join("\n\n")
  };
}

async function pushWithProvider(
  settings: InternalSitePushSettings,
  provider: SitePushProvider,
  urls: string[],
  action: SitePushAction
): Promise<ProviderPushSummary> {
  const summary = emptyProviderSummary();
  let pendingUrls = urls;
  const batchSize =
    provider === SitePushProvider.BAIDU
      ? BAIDU_BATCH_SIZE
      : provider === SitePushProvider.BING
        ? INDEXNOW_BATCH_SIZE
        : GOOGLE_BATCH_SIZE;

  try {
    pendingUrls = await filterRecentlySuccessfulUrls(provider, urls);
    const skippedUrls = urls.filter((url) => !pendingUrls.includes(url));
    await Promise.all(
      skippedUrls.map((url) =>
        createRecord(provider, url, action, {
          status: SitePushStatus.SKIPPED,
          error: "URL was pushed successfully within the last 24 hours."
        })
      )
    );
    addProviderResult(summary, SitePushStatus.SKIPPED, skippedUrls.length);

    for (const batch of chunks(pendingUrls, batchSize)) {
      const result =
        provider === SitePushProvider.BAIDU
          ? await pushBaidu(settings, batch)
          : provider === SitePushProvider.BING
            ? await pushBing(settings, batch)
            : await pushGoogle(settings, batch);

      await Promise.all(batch.map((url) => createRecord(provider, url, action, result)));
      addProviderResult(summary, result.status, batch.length);
    }
  } catch (error) {
    await Promise.all(
      pendingUrls.map((url) =>
        createRecord(provider, url, action, {
          status: SitePushStatus.FAILED,
          error: error instanceof Error ? error.message : "Push request failed."
        })
      )
    );
    addProviderResult(summary, SitePushStatus.FAILED, pendingUrls.length);
  }

  return summary;
}

function normalizeProviders(values: FormDataEntryValue[]) {
  const selected = new Set(values.map((value) => String(value).toUpperCase()));
  return [SitePushProvider.BAIDU, SitePushProvider.BING, SitePushProvider.GOOGLE].filter((provider) =>
    selected.has(provider)
  );
}

function normalizeSubmittedUrl(value: string, settings: InternalSitePushSettings) {
  const parsed = parseUrlLike(value);
  if (!parsed) {
    throw new Error("Please enter a valid absolute URL.");
  }
  if (settings.siteHost && parsed.host !== settings.siteHost) {
    throw new Error(`URL host must match the configured site host: ${settings.siteHost}.`);
  }
  return parsed.toString();
}

export async function pushManualUrl(user: CurrentUser, formData: FormData) {
  assertPermission(canManageSettings(user), "You do not have permission to push site URLs.");
  const settings = await loadInternalSettings();
  const url = normalizeSubmittedUrl(String(formData.get("url") ?? "").trim(), settings);
  const providers = normalizeProviders(formData.getAll("providers"));
  if (!providers.length) {
    throw new Error("Please choose at least one configured provider.");
  }

  const unavailable = providers.filter((provider) => !isProviderAvailable(settings, provider));
  if (unavailable.length) {
    throw new Error(`Selected providers are not enabled or fully configured: ${unavailable.join(", ")}.`);
  }

  return pushUrls([url], providers, SitePushAction.MANUAL, settings);
}

export async function pushPublishedArticles(user: CurrentUser) {
  assertPermission(canManageSettings(user), "You do not have permission to push site URLs.");
  const settings = await loadInternalSettings();
  const providers = getEnabledProviders(settings);
  if (!providers.length) {
    throw new Error("No enabled site push providers are fully configured.");
  }

  const articles = await db.article.findMany({
    where: { status: ArticleStatus.PUBLISHED, deletedAt: null },
    orderBy: { publishedAt: "desc" },
    take: 100,
    select: {
      slug: true,
      title: true,
      contentHtml: true,
      status: true,
      deletedAt: true,
      sourceLocale: true,
      contents: {
        select: {
          locale: true,
          title: true,
          contentHtml: true,
          contentStatus: true
        }
      }
    }
  });
  const urls = articles.flatMap((article) => getIndexableArticleLocaleUrls(article, settings.siteUrl).map((item) => item.url));
  if (!urls.length) {
    return emptySubmissionSummary(0, providers.length);
  }
  return pushUrls(urls, providers, SitePushAction.BATCH, settings);
}

export async function pushArticleUrlAfterPublish(articleId: string) {
  if (!isDatabaseConfigured()) {
    return;
  }
  const settings = await loadInternalSettings();
  const providers = getEnabledProviders(settings);
  if (!providers.length) {
    return;
  }

  const article = await db.article.findUnique({
    where: { id: articleId },
    select: {
      slug: true,
      title: true,
      contentHtml: true,
      status: true,
      deletedAt: true,
      sourceLocale: true,
      contents: {
        select: {
          locale: true,
          title: true,
          contentHtml: true,
          contentStatus: true
        }
      }
    }
  });
  if (!article || article.deletedAt || article.status !== ArticleStatus.PUBLISHED) {
    return;
  }
  const urls = getIndexableArticleLocaleUrls(article, settings.siteUrl).map((item) => item.url);
  await pushUrls(urls, providers, SitePushAction.AUTO, settings);
}

async function pushUrls(
  urls: string[],
  providers: SitePushProvider[],
  action: SitePushAction,
  providedSettings?: InternalSitePushSettings
): Promise<SitePushSubmissionSummary> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }
  const settings = providedSettings ?? (await loadInternalSettings());
  const normalizedUrls = Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));
  if (!normalizedUrls.length) {
    return emptySubmissionSummary(0, providers.length);
  }
  const providerSummaries = await Promise.all(
    providers.map((provider) => pushWithProvider(settings, provider, normalizedUrls, action))
  );
  return providerSummaries.reduce<SitePushSubmissionSummary>((summary, providerSummary) => ({
    ...summary,
    records: summary.records + providerSummary.records,
    success: summary.success + providerSummary.success,
    failed: summary.failed + providerSummary.failed,
    skipped: summary.skipped + providerSummary.skipped
  }), emptySubmissionSummary(normalizedUrls.length, providers.length));
}

export async function getIndexNowKey() {
  if (!isDatabaseConfigured()) {
    return "";
  }
  const settings = await loadInternalSettings();
  return settings.bing.enabled ? settings.bing.key : "";
}
