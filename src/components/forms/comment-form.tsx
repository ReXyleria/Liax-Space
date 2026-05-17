"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type CommentApiResult = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export function CommentForm({ articleId }: { articleId: string }) {
  const [result, setResult] = useState<CommentApiResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          const response = await fetch("/api/comments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              articleId,
              content: formData.get("content")
            })
          });
          const nextResult = (await response.json()) as CommentApiResult;
          setResult(nextResult);
          if (nextResult.ok) {
            form.reset();
            router.refresh();
          }
        });
      }}
    >
      <Textarea name="content" placeholder="写下评论..." maxLength={1000} required />
      {result?.fieldErrors?.content?.[0] ? (
        <p className="text-sm text-destructive">{result.fieldErrors.content[0]}</p>
      ) : null}
      {result?.message ? (
        <p className={result.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>
          {result.message}
        </p>
      ) : null}
      <Button disabled={isPending}>{isPending ? "提交中..." : "发表评论"}</Button>
    </form>
  );
}
