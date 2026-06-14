import type { SiteSettings } from "../api/settingsApi";
import { baseThemeTokenValues, editableThemeTokens, themePresets, type ThemePresetId, type ThemeTokenValues } from "../pages/themePresets";

export const siteAppearanceUpdatedEventName = "liax:site-appearance-updated";

function isThemePresetId(value: unknown): value is ThemePresetId {
  return themePresets.some((preset) => preset.id === value);
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value);
}

function readCustomThemeValues(settings: SiteSettings, presetId: ThemePresetId): Partial<ThemeTokenValues> {
  const customColors = settings["theme.customColors"];

  if (!customColors || typeof customColors !== "object" || Array.isArray(customColors)) {
    return {};
  }

  const presetColors = (customColors as Record<string, unknown>)[presetId];

  if (!presetColors || typeof presetColors !== "object" || Array.isArray(presetColors)) {
    return {};
  }

  const values: Partial<ThemeTokenValues> = {};

  for (const tokenName of editableThemeTokens) {
    const color = (presetColors as Record<string, unknown>)[tokenName];

    if (isHexColor(color)) {
      values[tokenName] = color;
    }
  }

  return values;
}

export function resolveSiteTheme(settings: SiteSettings): ThemeTokenValues {
  const presetId = isThemePresetId(settings["theme.preset"]) ? settings["theme.preset"] : "warm-minimal";
  const preset = themePresets.find((item) => item.id === presetId) ?? themePresets[0];

  return {
    ...baseThemeTokenValues,
    ...preset.tokenValues,
    ...readCustomThemeValues(settings, presetId)
  };
}

export function applySiteTheme(settings: SiteSettings): void {
  if (typeof document === "undefined") {
    return;
  }

  const values = resolveSiteTheme(settings);

  for (const [tokenName, color] of Object.entries(values)) {
    document.documentElement.style.setProperty(tokenName, color);
  }
}

export function notifySiteAppearanceUpdated(settings: SiteSettings): void {
  applySiteTheme(settings);

  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<SiteSettings>(siteAppearanceUpdatedEventName, { detail: settings }));
}
