export function getSafeDeviceName(userAgent: string | null | undefined) {
  const source = userAgent ?? "";

  const os = source.includes("Windows")
    ? `Windows ${(source.match(/Windows NT (\d+\.\d+)/) ?? [])[1] ?? ""}`.replace(/\s+$/, "")
    : source.includes("Mac OS")
      ? `macOS ${(source.match(/Mac OS X (\d+[._]\d+)/) ?? [])[1]?.replace(/_/g, ".") ?? ""}`.replace(/\s+$/, "")
      : source.includes("Android")
        ? `Android ${(source.match(/Android (\d+(?:\.\d+)?)/) ?? [])[1] ?? ""}`.replace(/\s+$/, "")
        : source.includes("iPhone") || source.includes("iPad")
          ? `iOS ${(source.match(/OS (\d+[._]\d+)/) ?? [])[1]?.replace(/_/g, ".") ?? ""}`.replace(/\s+$/, "")
          : "未知系统";

  const browser = source.includes("Edg/")
    ? `Edge ${(source.match(/Edg\/(\d+)/) ?? [])[1] ?? ""}`.replace(/\s+$/, "")
    : source.includes("Chrome/")
      ? `Chrome ${(source.match(/Chrome\/(\d+)/) ?? [])[1] ?? ""}`.replace(/\s+$/, "")
      : source.includes("Firefox/")
        ? `Firefox ${(source.match(/Firefox\/(\d+)/) ?? [])[1] ?? ""}`.replace(/\s+$/, "")
        : source.includes("Safari/") && source.includes("Version/")
          ? `Safari ${(source.match(/Version\/(\d+\.\d+)/) ?? [])[1] ?? ""}`.replace(/\s+$/, "")
          : "浏览器";

  return `${browser} · ${os}`;
}
