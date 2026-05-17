import type { SettingsMap } from "@/features/settings/types";

const DEFAULT_BRAND = "Liax-Space";

export function getFooterBrandName(settings: SettingsMap) {
  return settings["footer.brandName"]?.trim() || settings["site.title"]?.trim() || DEFAULT_BRAND;
}

export function getFooterCopyright(settings: SettingsMap, year = new Date().getFullYear()) {
  const configured = settings["footer.copyright"]?.trim();
  if (configured) {
    return configured;
  }

  return `© ${year} ${getFooterBrandName(settings)}. All rights reserved.`;
}

export function shouldShowHomeContactCard(settings: SettingsMap) {
  return settings["contact.showOnHome"] !== "false";
}
