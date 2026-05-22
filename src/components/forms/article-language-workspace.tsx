"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArticleContentStatus, ArticleTranslationJobStatus } from "@prisma/client";
import { ArticleEditorForm } from "@/components/forms/article-editor-form";
import type { PreviewSiteSettings } from "@/components/forms/article-preview-overlay";
import { Button } from "@/components/ui/button";
import { translateArticleAction, type ArticleTranslationActionState } from "@/features/articles/translation-actions";
import type { Locale } from "@/lib/i18n-messages";

type ArticleLanguage = "zh-CN" | "en-US";
type ArticleFormValue = Parameters<typeof ArticleEditorForm>[0]["article"];
type ArticleContentValue = {
  id: string;
  locale: ArticleLanguage;
  title: string;
  summary: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  contentHtml: string;
  contentJson?: unknown;
  contentStatus: ArticleContentStatus;
  error: string | null;
  contentHash: string | null;
  updatedAtLabel?: string;
};

type TranslationProgressState = {
  status?: ArticleTranslationJobStatus;
  progress: number;
  completedUnits: number;
  totalUnits: number;
  message: string;
  error?: string | null;
};

const emptyDoc = { type: "doc", content: [] };

function labels(locale: Locale) {
  return locale === "en"
    ? {
        sourceLanguage: "Editing language",
        sourceLanguageNote: "Chinese and English use the same editor; switching loads that language content.",
        chinese: "Chinese",
        english: "English",
        translateToChinese: "Translate to Chinese",
        translateToEnglish: "Translate to English",
        manualTranslateHint: "Run translation for the other language now.",
        translating: "Translating...",
        progressFallback: "Preparing translation...",
        generatedHint: "Translation generated. Switch languages to review or apply it."
      }
    : {
        sourceLanguage: "编辑语言",
        sourceLanguageNote: "中文和英文使用同一个编辑器；切换后加载对应语言内容。",
        chinese: "中文",
        english: "英文",
        translateToChinese: "翻译为中文",
        translateToEnglish: "翻译为英文",
        manualTranslateHint: "立即为另一种语言执行翻译。",
        translating: "翻译中...",
        progressFallback: "正在准备翻译...",
        generatedHint: "译文已生成，可切换语言查看或应用。"
      };
}

function normalizeArticleLanguage(value: string | null | undefined): ArticleLanguage {
  return value?.toLowerCase().startsWith("en") ? "en-US" : "zh-CN";
}

function otherLanguage(value: ArticleLanguage): ArticleLanguage {
  return value === "zh-CN" ? "en-US" : "zh-CN";
}

function languageLabel(value: ArticleLanguage, locale: Locale) {
  const text = labels(locale);
  return value === "zh-CN" ? text.chinese : text.english;
}

export function ArticleLanguageWorkspace({
  article,
  tagOptions,
  site,
  contents,
  locale = "zh-CN"
}: {
  article: NonNullable<ArticleFormValue>;
  tagOptions: Array<{ name: string }>;
  site: PreviewSiteSettings;
  contents: ArticleContentValue[];
  locale?: Locale;
}) {
  const text = labels(locale);
  const router = useRouter();
  const initialSourceLocale = normalizeArticleLanguage(article.sourceLocale);
  const [sourceLocale, setSourceLocale] = useState<ArticleLanguage>(initialSourceLocale);
  const translationTarget = otherLanguage(sourceLocale);
  const activeContent = contents.find((content) => normalizeArticleLanguage(content.locale) === sourceLocale) ?? null;
  const counterpartContent = contents.find((content) => normalizeArticleLanguage(content.locale) === translationTarget) ?? null;
  const [translateState, translateFormAction, isTranslating] = useActionState<ArticleTranslationActionState, FormData>(
    translateArticleAction,
    { ok: false, message: "" }
  );
  const [progress, setProgress] = useState<TranslationProgressState | null>(null);

  const activeArticle = useMemo(() => ({
    ...article,
    sourceLocale,
    title: activeContent?.title ?? (sourceLocale === initialSourceLocale ? article.title : ""),
    summary: activeContent?.summary ?? (sourceLocale === initialSourceLocale ? article.summary : ""),
    seoTitle: activeContent?.seoTitle ?? (sourceLocale === initialSourceLocale ? article.seoTitle : ""),
    seoDescription: activeContent?.seoDescription ?? (sourceLocale === initialSourceLocale ? article.seoDescription : ""),
    contentHtml: activeContent?.contentHtml ?? (sourceLocale === initialSourceLocale ? article.contentHtml : ""),
    contentJson: activeContent?.contentJson ?? (sourceLocale === initialSourceLocale ? article.contentJson : emptyDoc)
  }), [activeContent, article, initialSourceLocale, sourceLocale]);

  useEffect(() => {
    if (translateState.ok) {
      router.refresh();
    }
  }, [router, translateState.ok]);

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
  }

  function translateButtonLabel(targetLocale: ArticleLanguage) {
    return targetLocale === "zh-CN" ? text.translateToChinese : text.translateToEnglish;
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
              {(["zh-CN", "en-US"] as const).map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant={sourceLocale === item ? "primary" : "ghost"}
                  onClick={() => changeSourceLocale(item)}
                >
                  {languageLabel(item, locale)}
                </Button>
              ))}
            </div>
            <form action={translateFormAction} className="shrink-0">
              <input type="hidden" name="articleId" value={article.id} />
              <input type="hidden" name="locale" value={translationTarget} />
              <Button type="submit" variant="secondary" title={text.manualTranslateHint}>
                {isTranslating ? text.translating : translateButtonLabel(translationTarget)}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {translateState.message ? (
        <p className={translateState.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>
          {translateState.ok ? text.generatedHint : translateState.message}
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

      <ArticleEditorForm
        key={`${sourceLocale}:${activeContent?.updatedAtLabel ?? "empty"}`}
        locale={locale}
        article={activeArticle}
        counterpartTranslation={counterpartContent}
        sourceLocale={sourceLocale}
        onSourceLocaleChange={changeSourceLocale}
        showSourceLocaleControl={false}
        tagOptions={tagOptions}
        site={site}
      />
    </div>
  );
}
