import { useCallback, useEffect, useMemo, useState } from "react";

export type VerifiedImageStatus = "empty" | "failed" | "loading" | "ready";

const failedImageUrls = new Set<string>();
const readyImageUrls = new Set<string>();

function normalizeImageUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }

  if (/^(?:https?:|blob:|data:image\/)/iu.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function useVerifiedImageUrl(value: string | null | undefined): {
  markFailed: () => void;
  status: VerifiedImageStatus;
  url: string | null;
} {
  const normalizedUrl = useMemo(() => normalizeImageUrl(value), [value]);
  const [status, setStatus] = useState<VerifiedImageStatus>(() => {
    if (!normalizedUrl) {
      return "empty";
    }

    return failedImageUrls.has(normalizedUrl) ? "failed" : "ready";
  });

  useEffect(() => {
    if (!normalizedUrl) {
      setStatus("empty");
      return;
    }

    if (failedImageUrls.has(normalizedUrl)) {
      setStatus("failed");
      return;
    }

    readyImageUrls.add(normalizedUrl);
    setStatus("ready");
  }, [normalizedUrl]);

  const markFailed = useCallback(() => {
    if (!normalizedUrl) {
      return;
    }

    readyImageUrls.delete(normalizedUrl);
    failedImageUrls.add(normalizedUrl);
    setStatus("failed");
  }, [normalizedUrl]);

  return {
    markFailed,
    status,
    url: status === "ready" ? normalizedUrl : null
  };
}
