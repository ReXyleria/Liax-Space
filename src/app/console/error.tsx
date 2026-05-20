"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/layout/error-panel";

export default function ConsoleError({
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
      title="后台操作失败"
      message="操作没有完成，页面仍可重试。请检查输入或稍后再试。"
      onRetry={reset}
    />
  );
}
