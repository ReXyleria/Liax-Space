"use client";

import { useActionState, useEffect, useState } from "react";
import type { TranslationStatus } from "@prisma/client";
import { ArticleEditorForm } from "@/components/forms/article-editor-form";
import { ArticleTranslationEditorForm } from "@/components/forms/article-translation-editor-form";
import type { PreviewSiteSettings } from "@/components/forms/article-preview-overlay";
import { Button } from "@/components/ui/button";
import { translateArticleAction, type ArticleTranslationActionState } from "@/features/articles/translation-actions";
import type { Locale } from "@/lib/i18n-messages";

type ArticleLanguage = "zh-CN" | "en";
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
        sourceLanguage: "Source language",
        sourceLanguageNote: "The selected language is saved in Article. The other language is saved in ArticleTranslation.",
        manualTranslate: "Rebuild translation",
        manualTranslateHint: "Run translation for the other language now.",
        translating: "Translating...",
        progressFallback: "Preparing translation..."
      }
    : {
        sourceLanguage: "原文语言",
        sourceLanguageNote: "选择的语言保存到 Article，另一种语言保存到 ArticleTranslation。",
        manualTranslate: "重新生成翻译",
        manualTranslateHint: "立即为另一种语言重新执行翻译。",
        translating: "翻译中...",
        progressFallback: "正在准备翻译..."
      };
}

function normalizeArticleLanguage(value: string | null | undefined): ArticleLanguage {
  return value?.toLowerCase().startsWith("en") ? "en" : "zh-CN";
}

function otherLanguage(value: ArticleLanguage): ArticleLanguage {
  return value === "zh-CN" ? "en" : "zh-CN";
}

function languageLabel(value: ArticleLanguage) {
  return value === "zh-CN" ? "中文" : "English";
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
  const initialSourceLocale = normalizeArticleLanguage(article.sourceLocale);
  const [sourceLocale, setSourceLocale] = useState<ArticleLanguage>(initialSourceLocale);
  const [language, setLanguage] = useState<ArticleLanguage>(initialSourceLocale);
  const translationTarget = otherLanguage(sourceLocale);
  const counterpartTranslation = translations.find((translation) => normalizeArticleLanguage(translation.locale) === translationTarget) ?? null;
  const activeTranslation = translations.find((translation) => normalizeArticleLanguage(translation.locale) === language) ?? null;
  const [translateState, translateFormAction, isTranslating] = useActionState<ArticleTranslationActionState, FormData>(
    translateArticleAction,
    { ok: false, message: "" }
  );
  const [progress, setProgress] = useState<TranslationProgressState | null>(null);

  useEffect(() => {
    if (!isTranslating) {
      return;
    }

    let cancelled = false;
    async function loadProgress() {
      try {
        const response = await fetch(`/api/console/articles/${article.id}/translation-progress?locale=${translationTarget}`, {
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
  }, [article.id, isTranslating, text.progressFallback, translationTarget]);

  function changeSourceLocale(nextLocale: ArticleLanguage) {
    setSourceLocale(nextLocale);
    setLanguage(nextLocale);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card/85 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium">{text.sourceLanguage}</p>
            <p className="mt-1 text-xs text-muted-foreground">{text.sourceLanguageNote}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-muted p-1">
              {(["zh-CN", "en"] as const).map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant={sourceLocale === item ? "primary" : "ghost"}
                  onClick={() => changeSourceLocale(item)}
                >
                  {languageLabel(item)}
                </Button>
              ))}
            </div>
            <form action={translateFormAction} className="shrink-0">
              <input type="hidden" name="articleId" value={article.id} />
              <input type="hidden" name="locale" value={translationTarget} />
              <Button type="submit" variant="secondary" title={text.manualTranslateHint}>
                {isTranslating ? text.translating : `${text.manualTranslate} ${languageLabel(translationTarget)}`}
              </Button>
            </form>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["zh-CN", "en"] as const).map((item) => (
            <Button
              key={item}
              type="button"
              variant={language === item ? "primary" : "ghost"}
              onClick={() => setLanguage(item)}
            >
              {languageLabel(item)}
            </Button>
          ))}
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

      {language === sourceLocale ? (
        <ArticleEditorForm
          locale={locale}
          article={{ ...article, sourceLocale }}
          counterpartTranslation={counterpartTranslation}
          sourceLocale={sourceLocale}
          onSourceLocaleChange={changeSourceLocale}
          showSourceLocaleControl={false}
          tagOptions={tagOptions}
          site={site}
        />
      ) : (
        <ArticleTranslationEditorForm
          article={{ ...article, sourceLocale }}
          targetLocale={language}
          translation={activeTranslation}
          locale={locale}
        />
      )}
    </div>
  );
}
