import { getSettingsMap } from "@/features/settings/service";

const fallbackSiteTitle = "Liax-Space";
const fallbackSiteUrl = "http://localhost:3000";

function normalizeUrl(value?: string | null) {
  const raw = value?.trim() || process.env.SITE_URL || process.env.NEXTAUTH_URL || fallbackSiteUrl;

  try {
    return new URL(raw).toString().replace(/\/$/, "");
  } catch {
    return fallbackSiteUrl;
  }
}

export async function getSiteConfig() {
  const { settings } = await getSettingsMap();

  return {
    title: settings["site.title"]?.trim() || fallbackSiteTitle,
    subtitle: settings["site.subtitle"]?.trim() || "",
    url: normalizeUrl(settings["site.url"])
  };
}

export async function getSiteTitle() {
  return (await getSiteConfig()).title;
}

export async function getSiteUrl() {
  return (await getSiteConfig()).url;
}

export async function getMetadataBase() {
  return new URL(await getSiteUrl());
}

export function resolveAbsoluteUrl(siteUrl: string, path: string) {
  return new URL(path.startsWith("/") ? path : `/${path}`, siteUrl).toString();
}
