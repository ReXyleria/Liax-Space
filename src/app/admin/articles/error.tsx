"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/layout/error-panel";

export default function AdminArticlesError({
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
      title="Article workspace failed"
      message="The article workspace hit a recoverable error. Retry keeps you inside the admin frame."
      onRetry={reset}
    />
  );
}
