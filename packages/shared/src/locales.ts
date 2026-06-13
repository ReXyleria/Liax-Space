export type SupportedLocale = "zh-CN" | "en-US";

export type LocalePrefix = "zh" | "en";

export const SUPPORTED_LOCALES = ["zh-CN", "en-US"] as const satisfies readonly SupportedLocale[];

export const DEFAULT_LOCALE: SupportedLocale = "zh-CN";

const localePrefixMap: Record<SupportedLocale, LocalePrefix> = {
  "zh-CN": "zh",
  "en-US": "en"
};

const prefixLocaleMap: Record<LocalePrefix, SupportedLocale> = {
  zh: "zh-CN",
  en: "en-US"
};

export function localeToPrefix(locale: SupportedLocale): LocalePrefix {
  return localePrefixMap[locale];
}

export function prefixToLocale(prefix: LocalePrefix): SupportedLocale {
  return prefixLocaleMap[prefix];
}

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

