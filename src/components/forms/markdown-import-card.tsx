"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";
import { importMarkdownArticleAction, type MarkdownImportActionState } from "@/features/articles/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import type { Locale } from "@/lib/i18n-messages";

const initialState: MarkdownImportActionState = {
  ok: false,
  message: "",
  fieldErrors: {}
};

function labels(locale: Locale) {
  return locale === "en"
    ? {
        title: "Import Markdown",
        description: "Upload one .md file to create a standalone draft article.",
        fileLabel: "Markdown file",
        languageLabel: "Default source language",
        chinese: "Chinese",
        english: "English",
        submit: "Import",
        importing: "Importing...",
        hint: "Front matter is supported. Remote images are localized when possible."
      }
    : {
        title: "导入 Markdown",
        description: "上传一个 .md 文件，创建一篇独立草稿文章。",
        fileLabel: "Markdown 文件",
        languageLabel: "默认原文语言",
        chinese: "中文",
        english: "English",
        submit: "导入",
        importing: "导入中...",
        hint: "支持 front matter；远程图片会尽量本地化。"
      };
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

export function MarkdownImportCard({ locale = "zh-CN" }: { locale?: Locale }) {
  const text = labels(locale);
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<MarkdownImportActionState, FormData>(
    importMarkdownArticleAction,
    initialState
  );

  useEffect(() => {
    if (state.ok && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [router, state.ok, state.redirectTo]);

  return (
    <Card className="p-4">
      <form action={formAction} className="grid gap-4 lg:grid-cols-[1fr_220px_auto] lg:items-end">
        <div className="min-w-0 space-y-2">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <FileUp className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">{text.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{text.description}</p>
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{text.fileLabel}</span>
            <input
              type="file"
              name="markdownFile"
              accept=".md,.markdown,text/markdown,text/plain"
              disabled={isPending}
              className="block w-full rounded-md border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-60"
              required
            />
          </label>
          <FieldError messages={state.fieldErrors.markdownFile} />
          <p className="text-xs text-muted-foreground">{text.hint}</p>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{text.languageLabel}</span>
          <Select
            name="fallbackSourceLocale"
            defaultValue="zh-CN"
            disabled={isPending}
            options={[
              { value: "zh-CN", label: text.chinese },
              { value: "en-US", label: text.english }
            ]}
          />
          <FieldError messages={state.fieldErrors.fallbackSourceLocale} />
        </label>
        <Button type="submit" disabled={isPending} className="w-full lg:w-auto">
          {isPending ? text.importing : text.submit}
        </Button>
        {state.message ? (
          <p className={state.ok ? "lg:col-span-3 text-sm text-emerald-600" : "lg:col-span-3 text-sm text-destructive"}>
            {state.message}
          </p>
        ) : null}
      </form>
    </Card>
  );
}
