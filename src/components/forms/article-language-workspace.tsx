"use client";

import { useActionState, useState } from "react";
import type { TranslationStatus } from "@prisma/client";
import { ArticleEditorForm } from "@/components/forms/article-editor-form";
import { ArticleTranslationEditorForm } from "@/components/forms/article-translation-editor-form";
import type { PreviewSiteSettings } from "@/components/forms/article-preview-overlay";
import { Button } from "@/components/ui/button";
import { translateArticleAction, type ArticleTranslationActionState } from "@/features/articles/translation-actions";
import type { Locale } from "@/lib/i18n";

type ArticleFormValue = Parameters<typeof ArticleEditorForm>[0]["article"];
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

function labels(locale: Locale) {
  return locale === "en"
    ? {
        sourceTab: "Chinese source",
        translationTab: "English translation",
        note: "Chinese content is saved to Article, English content is saved to ArticleTranslation.",
        manualTranslate: "Rebuild English translation",
        manualTranslateHint: "Run translation for the current article now.",
        translating: "Translating..."
      }
    : {
        sourceTab: "中文原文",
        translationTab: "英文译文",
        note: "中文保存到 Article，英文保存到 ArticleTranslation。",
        manualTranslate: "重新生成英文译文",
        manualTranslateHint: "立即对当前文章重新执行翻译。",
        translating: "翻译中..."
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
  const englishTranslation = translations.find((translation) => translation.locale === "en") ?? null;

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

      {language === "zh-CN" ? (
        <ArticleEditorForm
          locale={locale}
          article={article}
          tagOptions={tagOptions}
          site={site}
        />
      ) : (
        <ArticleTranslationEditorForm article={article} translation={englishTranslation} locale={locale} />
      )}
    </div>
  );
}
