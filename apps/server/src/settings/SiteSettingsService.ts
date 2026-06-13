import { AppError } from "../common/AppError.js";
import { errorCodes } from "../common/errorCodes.js";
import { SettingsRepository } from "./SettingsRepository.js";
import type { SiteSettings } from "./settings.types.js";

type SiteSettingValidator = (key: string, value: unknown) => unknown;

const aiProviders = ["deepseek", "openai", "ollama"] as const;
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

function assertTemperature(key: string, value: unknown): number {
  const temperature = typeof value === "string" ? Number(value.trim()) : value;

  if (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    validationError(`${key} must be a number from 0 to 2.`);
  }

  return temperature;
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
  "ai.model": (key, value) => assertString(value, key, 160),
  "ai.provider": (key, value) => assertOneOf(value, key, aiProviders),
  "ai.translationTemperature": assertTemperature,
  "home.brandInfo": (key, value) => assertString(value, key, 240),
  "home.contactItems": (key, value) => assertString(value, key, 2000),
  "home.contactItems.en-US": (key, value) => assertString(value, key, 2000),
  "home.contactItems.zh-CN": (key, value) => assertString(value, key, 2000),
  "home.icpNumber": (key, value) => assertString(value, key, 120),
  "home.icpUrl": assertHttpUrl,
  "home.signature": (key, value) => assertString(value, key, 160),
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
  const redactedSettings = { ...settings };

  if (typeof redactedSettings["ai.apiKey"] === "string" && redactedSettings["ai.apiKey"].trim()) {
    delete redactedSettings["ai.apiKey"];
    redactedSettings["ai.apiKeyConfigured"] = true;
  } else {
    delete redactedSettings["ai.apiKey"];
    redactedSettings["ai.apiKeyConfigured"] = false;
  }

  return redactedSettings;
}

export class SiteSettingsService {
  constructor(private readonly settingsRepository = new SettingsRepository()) {}

  async getSiteSettings(): Promise<SiteSettings> {
    return redactSiteSettings(await this.settingsRepository.getSiteSettings());
  }

  async updateSiteSettings(input: unknown): Promise<SiteSettings> {
    const settings = validateSiteSettingsPatch(input);
    const nextSettings = { ...settings };

    if (typeof nextSettings["ai.apiKey"] === "string" && !nextSettings["ai.apiKey"].trim()) {
      delete nextSettings["ai.apiKey"];
    }

    return redactSiteSettings(await this.settingsRepository.updateSiteSettings(nextSettings));
  }
}
