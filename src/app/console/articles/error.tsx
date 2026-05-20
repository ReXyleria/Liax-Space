"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/layout/error-panel";

function errorDetails(error: Error & { digest?: string }) {
  const parts = [`type=${error.name || "Error"}`];
  if (error.digest) {
    parts.push(`digest=${error.digest}`);
  }
  if (process.env.NODE_ENV !== "production" && error.message) {
    parts.push(`message=${error.message}`);
  }
  return parts.join("; ");
}

export default function ConsoleArticlesError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[article-workspace] error boundary", {
      name: error.name,
      message: error.message,
      digest: error.digest,
      stack: error.stack
    });
  }, [error]);

  return (
    <ErrorPanel
      title="Article workspace failed"
      message={`The article workspace hit a recoverable core error. ${errorDetails(error)}. Check the server log for [article-workspace]. Retry keeps you inside the console frame.`}
      onRetry={reset}
    />
  );
}
