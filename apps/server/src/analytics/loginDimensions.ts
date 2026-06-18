import type { IncomingHttpHeaders } from "node:http";

function firstHeaderValue(value: unknown): string | null {
  if (Array.isArray(value)) {
    return value[0] ? String(value[0]) : null;
  }

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatVersion(value: string | undefined): string {
  return value ? value.replace(/_/g, ".") : "";
}

function readWindowsVersion(value: string): string | null {
  const match = /windows nt ([0-9.]+)/i.exec(value);
  const version = match?.[1];

  if (!version) {
    return /windows/i.test(value) ? "Windows" : null;
  }

  const names: Record<string, string> = {
    "10.0": "Windows 10/11",
    "6.3": "Windows 8.1",
    "6.2": "Windows 8",
    "6.1": "Windows 7",
    "6.0": "Windows Vista",
    "5.2": "Windows XP x64",
    "5.1": "Windows XP"
  };

  return names[version] ?? `Windows NT ${version}`;
}

export function readLoginCountry(headers: IncomingHttpHeaders | Record<string, unknown>): string {
  const country = firstHeaderValue(headers["cf-ipcountry"])
    ?? firstHeaderValue(headers["x-vercel-ip-country"])
    ?? firstHeaderValue(headers["cloudfront-viewer-country-name"])
    ?? firstHeaderValue(headers["x-country"]);

  return country ? country.slice(0, 80) : "Unknown";
}

export function readDetailedOperatingSystem(userAgent: string | null): string {
  const value = userAgent ?? "";

  if (!value.trim()) {
    return "Unknown";
  }

  if (/bot|crawl|spider|slurp|bingpreview/i.test(value)) {
    return "Bot";
  }

  const windows = readWindowsVersion(value);
  if (windows) {
    return windows;
  }

  const cros = /CrOS [^ )]+ ([0-9.]+)/i.exec(value);
  if (cros?.[1]) {
    return `ChromeOS ${cros[1]}`;
  }

  const android = /Android ([0-9.]+)/i.exec(value);
  if (android?.[1]) {
    return `Android ${android[1]}`;
  }

  const iphone = /iPhone OS ([0-9_]+)/i.exec(value);
  if (iphone?.[1]) {
    return `iOS ${formatVersion(iphone[1])}`;
  }

  const ipad = /CPU OS ([0-9_]+)/i.exec(value);
  if (/iPad/i.test(value) && ipad?.[1]) {
    return `iPadOS ${formatVersion(ipad[1])}`;
  }

  const macos = /Mac OS X ([0-9_]+)/i.exec(value);
  if (macos?.[1]) {
    return `macOS ${formatVersion(macos[1])}`;
  }

  if (/Android/i.test(value)) {
    return "Android";
  }

  if (/iPhone|iPod/i.test(value)) {
    return "iOS";
  }

  if (/iPad/i.test(value)) {
    return "iPadOS";
  }

  if (/Macintosh|Mac OS X/i.test(value)) {
    return "macOS";
  }

  if (/Linux/i.test(value)) {
    return "Linux";
  }

  return "Unknown";
}
