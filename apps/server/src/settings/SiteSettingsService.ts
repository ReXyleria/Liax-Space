import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { SettingsRepository } from "./SettingsRepository.js";
import type { SiteSettings } from "./settings.types.js";

type SiteSettingValidator = (key: string, value: unknown) => unknown;

const aiProviders = ["deepseek", "openai", "ollama"] as const;
const smtpEncryptionModes = ["none", "starttls", "ssl_tls"] as const;
const themePresetIds = ["warm-minimal", "quiet-garden", "clear-graphite"] as const;
const editableThemeTokens = [
  "--color-accent",
  "--color-border",
  "--color-brand",
  "--color-primary",
  "--color-surface-muted"
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validationError(message: string): never {
  throw new AppError(message, {
    code: errorCodes.validationFailed,
    statusCode: 400
  });
}

function assertJsonValue(value: unknown): void {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") {
    validationError("Site setting value must be JSON serializable.");
  }

  try {
    JSON.stringify(value);
  } catch {
    validationError("Site setting value must be JSON serializable.");
  }
}

function assertString(value: unknown, key: string, maxLength: number): string {
  if (typeof value !== "string") {
    validationError(`${key} must be a string.`);
  }

  const normalized = value.trim();

  if (normalized.length > maxLength) {
    validationError(`${key} must be ${maxLength} characters or fewer.`);
  }

  return normalized;
}

function assertBoolean(key: string, value: unknown): boolean {
  if (typeof value !== "boolean") {
    validationError(`${key} must be a boolean.`);
  }

  return value;
}

function assertEmailAddress(key: string, value: unknown): string {
  const normalized = assertString(value, key, 320);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) {
    validationError(`${key} must be a valid email address.`);
  }

  return normalized;
}

function assertHttpUrl(key: string, value: unknown): string {
  const normalized = assertString(value, key, 500);
  let url: URL;

  try {
    url = new URL(normalized);
  } catch {
    validationError(`${key} must be a valid URL.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    validationError(`${key} must use http or https.`);
  }

  return url.toString().replace(/\/$/u, "");
}

function assertOptionalHttpUrl(key: string, value: unknown): string {
  const normalized = assertString(value, key, 500);

  if (!normalized) {
    return "";
  }

  return assertHttpUrl(key, normalized);
}

function assertOptionalPublicAssetUrl(key: string, value: unknown): string {
  const normalized = assertString(value, key, 500);

  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("/") && !normalized.startsWith("//") && !/[\u0000-\u001f]/u.test(normalized)) {
    return normalized;
  }

  return assertHttpUrl(key, normalized);
}

function assertTemperature(key: string, value: unknown): number {
  const temperature = typeof value === "string" ? Number(value.trim()) : value;

  if (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    validationError(`${key} must be a number from 0 to 2.`);
  }

  return temperature;
}

function assertPort(key: string, value: unknown): number {
  const port = typeof value === "string" ? Number(value.trim()) : value;

  if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
    validationError(`${key} must be an integer from 1 to 65535.`);
  }

  return port;
}

function assertIntegerRange(key: string, value: unknown, min: number, max: number): number {
  const integer = typeof value === "string" ? Number(value.trim()) : value;

  if (typeof integer !== "number" || !Number.isInteger(integer) || integer < min || integer > max) {
    validationError(`${key} must be an integer from ${min} to ${max}.`);
  }

  return integer;
}

function assertOneOf<T extends readonly string[]>(value: unknown, key: string, allowedValues: T): T[number] {
  if (typeof value !== "string" || !allowedValues.includes(value as T[number])) {
    validationError(`${key} must be one of: ${allowedValues.join(", ")}.`);
  }

  return value;
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value);
}

function normalizePlaceholderCandidate(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

const placeholderIcpNumbers = new Set([
  "备案号待配置",
  "icp pending",
  "icp备案号",
  "icp 备案号"
]);

export function isPlaceholderSiteSettingValue(key: string, value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = normalizePlaceholderCandidate(value);

  if (!normalized) {
    return false;
  }

  if (key === "home.icpNumber") {
    return placeholderIcpNumbers.has(normalized);
  }

  if (key === "home.contactItems" || key === "home.contactItems.en-US" || key === "home.contactItems.zh-CN") {
    const compact = normalized.replace(/[\s:：-]/gu, "");

    return compact.includes("hello@example.com") || compact.includes("qq123456") || normalized === "contact pending" || normalized === "联系方式待配置";
  }

  if (key === "home.brandInfo" || key === "home.signature") {
    return /当前版本先提供稳定跳转/u.test(value) || /作者\s*·\s*liax/iu.test(value) || /author\s*·\s*liax/iu.test(value);
  }

  return false;
}

function sanitizeSiteSettingValue(key: string, value: unknown): unknown {
  return isPlaceholderSiteSettingValue(key, value) ? "" : value;
}

function sanitizeSiteSettings(settings: SiteSettings): SiteSettings {
  const sanitizedSettings: SiteSettings = {};

  for (const [key, value] of Object.entries(settings)) {
    sanitizedSettings[key] = sanitizeSiteSettingValue(key, value);
  }

  return sanitizedSettings;
}

function sanitizeStringValidator(validator: SiteSettingValidator): SiteSettingValidator {
  return (key, value) => sanitizeSiteSettingValue(key, validator(key, value));
}

function validateThemeCustomColors(key: string, value: unknown): Record<string, Record<string, string>> {
  if (!isPlainObject(value)) {
    validationError(`${key} must be an object.`);
  }

  const normalized: Record<string, Record<string, string>> = {};

  for (const [presetId, tokenValues] of Object.entries(value)) {
    if (!themePresetIds.includes(presetId as (typeof themePresetIds)[number])) {
      validationError(`${key} contains an unknown preset: ${presetId}.`);
    }

    if (!isPlainObject(tokenValues)) {
      validationError(`${key}.${presetId} must be an object.`);
    }

    normalized[presetId] = {};

    for (const [tokenName, color] of Object.entries(tokenValues)) {
      if (!editableThemeTokens.includes(tokenName as (typeof editableThemeTokens)[number])) {
        validationError(`${key}.${presetId} contains an unknown token: ${tokenName}.`);
      }

      if (!isHexColor(color)) {
        validationError(`${key}.${presetId}.${tokenName} must be a 6 digit hex color.`);
      }

      normalized[presetId][tokenName] = color.toLowerCase();
    }
  }

  return normalized;
}

const knownSettingValidators: Record<string, SiteSettingValidator> = {
  "ai.apiKey": (key, value) => assertString(value, key, 4000),
  "ai.apiKeyConfigured": () => validationError("ai.apiKeyConfigured is read-only."),
  "ai.baseUrl": assertHttpUrl,
  "ai.chunkConcurrency": (key, value) => assertIntegerRange(key, value, 1, 16),
  "ai.model": (key, value) => assertString(value, key, 160),
  "ai.provider": (key, value) => assertOneOf(value, key, aiProviders),
  "ai.translationTemperature": assertTemperature,
  "home.brandInfo": sanitizeStringValidator((key, value) => assertString(value, key, 240)),
  "home.contactItems": sanitizeStringValidator((key, value) => assertString(value, key, 2000)),
  "home.contactItems.en-US": sanitizeStringValidator((key, value) => assertString(value, key, 2000)),
  "home.contactItems.zh-CN": sanitizeStringValidator((key, value) => assertString(value, key, 2000)),
  "home.icpNumber": sanitizeStringValidator((key, value) => assertString(value, key, 120)),
  "home.icpUrl": assertHttpUrl,
  "home.signature": sanitizeStringValidator((key, value) => assertString(value, key, 160)),
  "codeInjection.contentHead": (key, value) => assertString(value, key, 50000),
  "codeInjection.footer": (key, value) => assertString(value, key, 50000),
  "codeInjection.globalHead": (key, value) => assertString(value, key, 50000),
  "site.logoAlt": (key, value) => assertString(value, key, 120),
  "site.logoUrl": assertOptionalPublicAssetUrl,
  "seoPush.baidu.enabled": assertBoolean,
  "seoPush.baidu.key": (key, value) => assertString(value, key, 4000),
  "seoPush.baidu.site": assertOptionalHttpUrl,
  "seoPush.baidu.url": assertOptionalHttpUrl,
  "seoPush.google.enabled": assertBoolean,
  "seoPush.google.key": (key, value) => assertString(value, key, 4000),
  "seoPush.google.site": assertOptionalHttpUrl,
  "seoPush.google.url": assertOptionalHttpUrl,
  "seoPush.indexnow.enabled": assertBoolean,
  "seoPush.indexnow.key": (key, value) => assertString(value, key, 4000),
  "seoPush.indexnow.site": (key, value) => assertString(value, key, 255),
  "seoPush.indexnow.url": assertOptionalHttpUrl,
  "smtp.encryption": (key, value) => assertOneOf(value, key, smtpEncryptionModes),
  "smtp.from": assertEmailAddress,
  "smtp.fromName": (key, value) => assertString(value, key, 80),
  "smtp.host": (key, value) => assertString(value, key, 255),
  "smtp.notificationsEnabled": assertBoolean,
  "smtp.pass": (key, value) => assertString(value, key, 4000),
  "smtp.passConfigured": () => validationError("smtp.passConfigured is read-only."),
  "smtp.port": assertPort,
  "smtp.user": (key, value) => assertString(value, key, 320),
  "theme.customColors": validateThemeCustomColors,
  "theme.preset": (key, value) => assertOneOf(value, key, themePresetIds)
};

function validateSiteSettingsPatch(value: unknown): SiteSettings {
  if (!isPlainObject(value)) {
    validationError("Site settings patch must be an object.");
  }

  const normalizedSettings: SiteSettings = {};

  for (const [key, settingValue] of Object.entries(value)) {
    if (!key.trim()) {
      validationError("Site setting key must not be empty.");
    }

    assertJsonValue(settingValue);
    normalizedSettings[key] = knownSettingValidators[key]?.(key, settingValue) ?? settingValue;
  }

  return normalizedSettings;
}

function redactSiteSettings(settings: SiteSettings): SiteSettings {
  const redactedSettings = sanitizeSiteSettings(settings);

  for (const [secretKey, configuredKey] of [
    ["ai.apiKey", "ai.apiKeyConfigured"],
    ["smtp.pass", "smtp.passConfigured"]
  ] as const) {
    if (typeof redactedSettings[secretKey] === "string" && redactedSettings[secretKey].trim()) {
      delete redactedSettings[secretKey];
      redactedSettings[configuredKey] = true;
    } else {
      delete redactedSettings[secretKey];
      redactedSettings[configuredKey] = false;
    }
  }

  return redactedSettings;
}

const appearanceSettingKeys = [
  "site.logoAlt",
  "site.logoUrl",
  "theme.customColors",
  "theme.preset"
] as const;

function pickAppearanceSettings(settings: SiteSettings): SiteSettings {
  const appearanceSettings: SiteSettings = {};

  for (const key of appearanceSettingKeys) {
    if (settings[key] !== undefined) {
      appearanceSettings[key] = settings[key];
    }
  }

  return appearanceSettings;
}

export class SiteSettingsService {
  constructor(private readonly settingsRepository = new SettingsRepository()) {}

  async getSiteSettings(): Promise<SiteSettings> {
    return redactSiteSettings(await this.settingsRepository.getSiteSettings());
  }

  async getAppearanceSettings(): Promise<SiteSettings> {
    return pickAppearanceSettings(await this.settingsRepository.getSiteSettings());
  }

  async updateSiteSettings(input: unknown): Promise<SiteSettings> {
    const settings = validateSiteSettingsPatch(input);
    const nextSettings = { ...settings };

    if (typeof nextSettings["ai.apiKey"] === "string" && !nextSettings["ai.apiKey"].trim()) {
      delete nextSettings["ai.apiKey"];
    }

    if (typeof nextSettings["smtp.pass"] === "string" && !nextSettings["smtp.pass"].trim()) {
      delete nextSettings["smtp.pass"];
    }

    return redactSiteSettings(await this.settingsRepository.updateSiteSettings(nextSettings));
  }
}
