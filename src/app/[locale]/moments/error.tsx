"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/layout/error-panel";

export default function MomentsError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error(error);
    }
  }, [error]);

  return (
    <ErrorPanel
      title="Moments failed to load"
      message="The moments timeline hit a recoverable error. You can retry without leaving the page."
      onRetry={reset}
    />
  );
}
