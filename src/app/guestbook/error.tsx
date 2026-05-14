"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/layout/error-panel";

export default function GuestbookError({
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
      title="Guestbook failed to load"
      message="The guestbook hit a recoverable error. You can retry without losing the rest of the site context."
      onRetry={reset}
    />
  );
}
