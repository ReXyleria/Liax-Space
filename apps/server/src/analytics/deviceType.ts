export type DeviceType =
  | "android"
  | "bot"
  | "desktop"
  | "ios"
  | "ipados"
  | "linux"
  | "macos"
  | "mobile"
  | "tablet"
  | "unknown"
  | "windows"
  | "windows-phone";

const knownDeviceTypes = new Set<DeviceType>([
  "android",
  "bot",
  "desktop",
  "ios",
  "ipados",
  "linux",
  "macos",
  "mobile",
  "tablet",
  "unknown",
  "windows",
  "windows-phone"
]);

export function normalizeDeviceType(value: string | null): DeviceType {
  const normalized = value?.trim().toLowerCase() ?? "";

  return knownDeviceTypes.has(normalized as DeviceType) ? normalized as DeviceType : "unknown";
}

export function readDeviceType(userAgent: string | null): DeviceType {
  const value = userAgent?.toLowerCase() ?? "";

  if (!value) {
    return "unknown";
  }

  if (/bot|crawl|spider|slurp|bingpreview/.test(value)) {
    return "bot";
  }

  if (/android/.test(value)) {
    return "android";
  }

  if (/iphone|ipod/.test(value)) {
    return "ios";
  }

  if (/ipad|macintosh.+mobile/.test(value)) {
    return "ipados";
  }

  if (/windows phone/.test(value)) {
    return "windows-phone";
  }

  if (/windows nt|win64|wow64/.test(value)) {
    return "windows";
  }

  if (/macintosh|mac os x/.test(value)) {
    return "macos";
  }

  if (/kindle|silk|tablet/.test(value)) {
    return "tablet";
  }

  if (/linux/.test(value)) {
    return "linux";
  }

  if (/mobile/.test(value)) {
    return "mobile";
  }

  return "desktop";
}
