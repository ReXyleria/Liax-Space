"use client";

import { useActionState, useEffect, useState } from "react";
import type { TranslationStatus } from "@prisma/client";
import { ArticleEditorForm } from "@/components/forms/article-editor-form";
import { ArticleTranslationEditorForm } from "@/components/forms/article-translation-editor-form";
import type { PreviewSiteSettings } from "@/components/forms/article-preview-overlay";
import { Button } from "@/components/ui/button";
import { translateArticleAction, type ArticleTranslationActionState } from "@/features/articles/translation-actions";
import type { Locale } from "@/lib/i18n-messages";

type ArticleFormValue = Parameters<typeof ArticleEditorForm>[0]["article"];
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

type TranslationProgressState = {
  status?: TranslationStatus;
  progress: number;
  completedUnits: number;
  totalUnits: number;
  message: string;
  error?: string | null;
};

function labels(locale: Locale) {
  return locale === "en"
    ? {
        sourceTab: "Chinese source",
        translationTab: "English translation",
        note: "Chinese content is saved to Article, English content is saved to ArticleTranslation.",
        manualTranslate: "Rebuild English translation",
        manualTranslateHint: "Run translation for the current article now.",
        translating: "Translating...",
        progressFallback: "Preparing translation..."
      }
    : {
        sourceTab: "中文原文",
        translationTab: "英文译文",
        note: "中文保存到 Article，英文保存到 ArticleTranslation。",
        manualTranslate: "重新生成英文译文",
        manualTranslateHint: "立即对当前文章重新执行翻译。",
        translating: "翻译中...",
        progressFallback: "正在准备翻译..."
      };
}

export function ArticleLanguageWorkspace({
  article,
  tagOptions,
  site,
  translations,
  locale = "zh-CN"
}: {
  article: NonNullable<ArticleFormValue>;
  tagOptions: Array<{ name: string }>;
  site: PreviewSiteSettings;
  translations: TranslationValue[];
  locale?: Locale;
}) {
  const text = labels(locale);
  const [translateState, translateFormAction, isTranslating] = useActionState<ArticleTranslationActionState, FormData>(
    translateArticleAction,
    { ok: false, message: "" }
  );
  const [language, setLanguage] = useState<"zh-CN" | "en">("zh-CN");
  const [progress, setProgress] = useState<TranslationProgressState | null>(null);
  const englishTranslation = translations.find((translation) => translation.locale === "en") ?? null;

  useEffect(() => {
    if (!isTranslating) {
      return;
    }

    let cancelled = false;
    async function loadProgress() {
      try {
        const response = await fetch(`/api/admin/articles/${article.id}/translation-progress?locale=en`, {
          cache: "no-store"
        });
        const payload = await response.json();
        const item = payload?.progress;
        if (!cancelled && item) {
          setProgress({
            status: item.status,
            progress: Number(item.progress ?? 0),
            completedUnits: Number(item.completedUnits ?? 0),
            totalUnits: Number(item.totalUnits ?? 0),
            message: String(item.progressMessage ?? ""),
            error: item.error ?? null
          });
        }
      } catch (error) {
        if (!cancelled) {
          setProgress((current) => current ?? {
            progress: 0,
            completedUnits: 0,
            totalUnits: 0,
            message: error instanceof Error ? error.message : text.progressFallback
          });
        }
      }
    }

    void loadProgress();
    const timer = window.setInterval(loadProgress, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [article.id, isTranslating, text.progressFallback]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/85 p-2">
        <Button
          type="button"
          variant={language === "zh-CN" ? "primary" : "ghost"}
          onClick={() => setLanguage("zh-CN")}
        >
          {text.sourceTab}
        </Button>
        <Button
          type="button"
          variant={language === "en" ? "primary" : "ghost"}
          onClick={() => setLanguage("en")}
        >
          {text.translationTab}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <span className="px-3 text-xs text-muted-foreground">{text.note}</span>
          <form action={translateFormAction} className="shrink-0">
            <input type="hidden" name="articleId" value={article.id} />
            <input type="hidden" name="locale" value="en" />
            <Button type="submit" variant="secondary" title={text.manualTranslateHint}>
              {isTranslating ? text.translating : text.manualTranslate}
            </Button>
          </form>
        </div>
      </div>

      {translateState.message ? (
        <p className={translateState.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>
          {translateState.message}
        </p>
      ) : null}

      {isTranslating || progress ? (
        <div className="rounded-lg border bg-card/80 p-3">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{progress?.message || text.progressFallback}</span>
            <span>{Math.max(0, Math.min(100, progress?.progress ?? 0))}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.max(0, Math.min(100, progress?.progress ?? 0))}%` }}
            />
          </div>
          {progress?.totalUnits ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {progress.completedUnits}/{progress.totalUnits}
            </p>
          ) : null}
          {progress?.error ? <p className="mt-1 text-xs text-destructive">{progress.error}</p> : null}
        </div>
      ) : null}

      {language === "zh-CN" ? (
        <ArticleEditorForm
          locale={locale}
          article={article}
          englishTranslation={englishTranslation}
          tagOptions={tagOptions}
          site={site}
        />
      ) : (
        <ArticleTranslationEditorForm article={article} translation={englishTranslation} locale={locale} />
      )}
    </div>
  );
}
