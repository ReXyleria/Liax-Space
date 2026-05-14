export function getSafeDeviceName(userAgent: string | null | undefined) {
  const source = userAgent ?? "";
  const os = source.includes("Windows")
    ? "Windows"
    : source.includes("Mac OS")
      ? "macOS"
      : source.includes("Android")
        ? "Android"
        : source.includes("iPhone") || source.includes("iPad")
          ? "iOS"
          : "未知系统";
  const browser = source.includes("Edg/")
    ? "Edge"
    : source.includes("Chrome/")
      ? "Chrome"
      : source.includes("Firefox/")
        ? "Firefox"
        : source.includes("Safari/")
          ? "Safari"
          : "浏览器";

  return `${browser} · ${os}`;
}
