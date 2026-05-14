"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ErrorPanel({
  title = "页面暂时无法显示",
  message = "请求处理失败，请重试。",
  onRetry
}: {
  title?: string;
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center px-6 py-16">
      <Card className="w-full p-6">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
        <Button type="button" className="mt-5" onClick={onRetry}>
          重试
        </Button>
      </Card>
    </div>
  );
}
