function normalizeUploadPath(pathname: string) {
  if (pathname.startsWith("/api/runtime-uploads/")) {
    return `/uploads/${pathname.slice("/api/runtime-uploads/".length)}`;
  }
  return pathname;
}

export function normalizeMediaReferenceUrl(value: string | null | undefined) {
  const raw = value?.trim() ?? "";
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw, "http://local.invalid");
    const pathname = normalizeUploadPath(parsed.pathname);
    if (pathname.startsWith("/uploads/")) {
      return decodeURI(pathname);
    }
  } catch {
    // Keep the raw value below for non-URL snippets.
  }

  if (raw.startsWith("/api/runtime-uploads/")) {
    return `/uploads/${raw.slice("/api/runtime-uploads/".length)}`;
  }

  return raw;
}

export function mediaUrlMatchesReference(referenceValue: string | null | undefined, assetUrl: string | null | undefined) {
  const reference = normalizeMediaReferenceUrl(referenceValue);
  const asset = normalizeMediaReferenceUrl(assetUrl);
  return Boolean(reference && asset && reference === asset);
}
