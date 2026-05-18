"use client";

import { TranslationStatus } from "@prisma/client";
import { Save, Sparkles } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { BlockEditor } from "@/components/editor/block-editor/block-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateArticleSeoAction } from "@/features/articles/actions";
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
  seoTitle: string | null;
  seoDescription: string | null;
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
        description: "This tab edits the database-backed translation. Saving here will not overwrite the Chinese source article.",
        status: "Status",
        noRecord: "No translated record exists yet. The source content is loaded as a starting point.",
        summary: "Translated summary",
        seo: "English SEO",
        seoHint: "Generate with the translation AI settings, then adjust manually.",
        seoTitle: "SEO title",
        seoDescription: "SEO description",
        generateSeo: "Generate SEO",
        generatingSeo: "Generating...",
        save: "Save English translation",
        saving: "Saving..."
      }
    : {
        title: "英文译文",
        description: "此页编辑数据库中的英文译文记录。保存不会覆盖中文原文。",
        status: "状态",
        noRecord: "当前还没有译文记录，已先加载原文作为起点。",
        summary: "译文摘要",
        seo: "英文 SEO",
        seoHint: "使用翻译页的 AI 接口配置生成，生成后可继续手动修改。",
        seoTitle: "SEO 标题",
        seoDescription: "SEO 描述",
        generateSeo: "AI 生成 SEO",
        generatingSeo: "生成中...",
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
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, isPending] = useActionState<ArticleTranslationActionState, FormData>(
    updateArticleTranslationAction,
    initialState
  );
  const [title, setTitle] = useState(translation?.title ?? article.title);
  const [summary, setSummary] = useState(translation?.summary ?? article.summary ?? "");
  const [seoTitle, setSeoTitle] = useState(translation?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(translation?.seoDescription ?? "");
  const [seoMessage, setSeoMessage] = useState("");
  const [seoError, setSeoError] = useState("");
  const [isGeneratingSeo, startSeoTransition] = useTransition();
  const initialJson = useMemo(() => translation?.contentJson ?? undefined, [translation?.contentJson]);
  const initialHtml = translation?.contentHtml || article.contentHtml;

  useEffect(() => {
    setTitle(translation?.title ?? article.title);
    setSummary(translation?.summary ?? article.summary ?? "");
    setSeoTitle(translation?.seoTitle ?? "");
    setSeoDescription(translation?.seoDescription ?? "");
  }, [article.summary, article.title, translation?.seoDescription, translation?.seoTitle, translation?.summary, translation?.title]);

  function handleGenerateSeo() {
    if (!formRef.current || isGeneratingSeo) {
      return;
    }

    setSeoError("");
    setSeoMessage("");
    const current = new FormData(formRef.current);
    const formData = new FormData();
    formData.set("title", title);
    formData.set("summary", summary);
    formData.set("contentHtml", String(current.get("translationContentHtml") ?? ""));
    formData.set("targetLocale", "en");

    startSeoTransition(() => {
      void generateArticleSeoAction(formData)
        .then((result) => {
          if (!result.ok) {
            setSeoError(result.message);
            return;
          }
          if (result.seoTitle) {
            setSeoTitle(result.seoTitle);
          }
          if (result.seoDescription) {
            setSeoDescription(result.seoDescription);
          }
          setSeoMessage(result.message);
        })
        .catch((error) => {
          setSeoError(error instanceof Error ? error.message : "AI SEO generation failed.");
        });
    });
  }

  return (
    <form ref={formRef} action={action} className="space-y-5">
      <input type="hidden" name="articleId" value={article.id} />
      <input type="hidden" name="locale" value="en" />

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
        <Textarea name="summary" value={summary} onChange={(event) => setSummary(event.target.value)} />
      </label>

      <div className="rounded-lg border bg-muted/20 p-3">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">{text.seo}</p>
            <p className="text-xs text-muted-foreground">{text.seoHint}</p>
          </div>
          <Button type="button" variant="secondary" onClick={handleGenerateSeo} disabled={isGeneratingSeo}>
            <Sparkles className="mr-2 h-4 w-4" />
            {isGeneratingSeo ? text.generatingSeo : text.generateSeo}
          </Button>
        </div>
        <div className="space-y-3">
          <Input
            name="seoTitle"
            placeholder={text.seoTitle}
            value={seoTitle}
            onChange={(event) => setSeoTitle(event.target.value)}
          />
          <FieldError messages={state.fieldErrors?.seoTitle} />
          <Textarea
            name="seoDescription"
            placeholder={text.seoDescription}
            value={seoDescription}
            onChange={(event) => setSeoDescription(event.target.value)}
          />
          <FieldError messages={state.fieldErrors?.seoDescription} />
          {seoError ? <p className="text-xs text-destructive">{seoError}</p> : null}
          {seoMessage ? <p className="text-xs text-emerald-700">{seoMessage}</p> : null}
        </div>
      </div>

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
