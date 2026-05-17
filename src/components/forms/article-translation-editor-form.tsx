"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { TranslationStatus } from "@prisma/client";
import { Save } from "lucide-react";
import { BlockEditor } from "@/components/editor/block-editor/block-editor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  updateArticleTranslationAction,
  type ArticleTranslationActionState
} from "@/features/articles/translation-actions";
import type { Locale } from "@/lib/i18n-messages";

type TranslationValue = {
  id: string;
  locale: string;
  title: string;
  summary: string | null;
  contentHtml: string;
  contentJson?: unknown;
  status: TranslationStatus;
  error: string | null;
  contentHash: string | null;
  updatedAtLabel?: string;
};

type SourceArticleValue = {
  id: string;
  title: string;
  summary: string | null;
  contentHtml: string;
  contentJson: unknown;
};

function labels(locale: Locale) {
  return locale === "en"
    ? {
        title: "English translation",
        description:
          "This tab edits the database-backed translation. Saving here will not overwrite the Chinese source article.",
        status: "Status",
        noRecord: "No translated record exists yet. The source content is loaded as a starting point.",
        summary: "Translated summary",
        save: "Save English translation",
        saving: "Saving..."
      }
    : {
        title: "英文译文",
        description: "此页编辑数据库中的译文记录。保存不会覆盖中文原文。",
        status: "状态",
        noRecord: "当前还没有译文记录，已先加载原文作为起点。",
        summary: "译文摘要",
        save: "保存英文译文",
        saving: "保存中..."
      };
}

const initialState: ArticleTranslationActionState = {
  ok: false,
  message: "",
  fieldErrors: {}
};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

export function ArticleTranslationEditorForm({
  article,
  translation,
  locale = "en"
}: {
  article: SourceArticleValue;
  translation?: TranslationValue | null;
  locale?: Locale;
}) {
  const text = labels(locale);
  const [state, action, isPending] = useActionState<ArticleTranslationActionState, FormData>(
    updateArticleTranslationAction,
    initialState
  );
  const [title, setTitle] = useState(translation?.title ?? article.title);
  const initialJson = useMemo(() => translation?.contentJson ?? undefined, [translation?.contentJson]);
  const initialHtml = translation?.contentHtml || article.contentHtml;

  useEffect(() => {
    if (translation?.title) {
      setTitle(translation.title);
    }
  }, [translation?.title]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="articleId" value={article.id} />
      <input type="hidden" name="locale" value={locale} />

      <div className="rounded-xl border bg-card/80 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{text.title}</p>
        <p className="mt-1">{text.description}</p>
        {translation?.status ? (
          <p className="mt-2">
            {text.status}: {translation.status}
            {translation.updatedAtLabel ? ` · ${translation.updatedAtLabel}` : ""}
          </p>
        ) : (
          <p className="mt-2">{text.noRecord}</p>
        )}
        {translation?.error ? <p className="mt-2 text-destructive">{translation.error}</p> : null}
      </div>

      <div className="rounded-xl border bg-card p-5">
        <BlockEditor
          title={title}
          locale="en"
          initialHtml={initialHtml}
          initialJson={initialJson}
          htmlName="translationContentHtml"
          jsonName="translationContentJson"
          onTitleChange={setTitle}
        />
        <FieldError messages={state.fieldErrors?.title} />
        <FieldError messages={state.fieldErrors?.contentHtml} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{text.summary}</span>
        <Textarea name="summary" defaultValue={translation?.summary ?? article.summary ?? ""} />
      </label>

      {state.message ? (
        <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          <Save className="mr-2 h-4 w-4" />
          {isPending ? text.saving : text.save}
        </Button>
      </div>
    </form>
  );
}
