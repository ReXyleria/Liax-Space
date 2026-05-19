"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { ContentVisibility } from "@prisma/client";
import { Languages, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import { ThemedCheckbox } from "@/components/ui/themed-checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import {
  generateArticleSeoAction,
  updateArticleSettingsAction,
  type ArticleActionState
} from "@/features/articles/actions";
import { contentVisibilityOptions } from "@/lib/content-visibility";
import type { Locale } from "@/lib/i18n-messages";

type ArticleSettingsData = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  cover: string | null;
  contentHtml: string;
  visibility: ContentVisibility;
  allowComments: boolean;
  pinned: boolean;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  translationTargetLocale?: string;
  targetTranslationTitle?: string | null;
  targetTranslationSummary?: string | null;
  targetTranslationContentHtml?: string | null;
  targetTranslationSeoTitle?: string | null;
  targetTranslationSeoDescription?: string | null;
  tags: Array<{ name: string }>;
};

function labels(locale: Locale) {
  return locale === "en"
    ? {
        title: "Article settings",
        description: "Configure slug, summary, cover, visibility, tags, and SEO.",
        close: "Close",
        save: "Save settings",
        slugLabel: "Slug",
        slugPlaceholder: "Leave empty to auto-generate",
        summaryLabel: "Summary",
        summaryPlaceholder: "Article summary...",
        coverLabel: "Cover",
        visibilityLabel: "Visibility",
        tagsLabel: "Tags",
        tagsPlaceholder: "Choose or create tags",
        chineseSeo: "Chinese SEO",
        englishSeo: "English SEO",
        seoTitleLabel: "SEO title",
        seoDescriptionLabel: "SEO description",
        generateSeo: "AI generate SEO",
        generatingSeo: "Generating...",
        translationQueued: "English translation is not ready. The article has been queued for translation.",
        allowCommentsLabel: "Allow comments",
        pinnedLabel: "Pinned",
        featuredLabel: "Featured",
        publishedAtLabel: "Publish date",
        publishedAtHint: "Set the original publish date for imported articles.",
        saving: "Saving..."
      }
    : {
        title: "文章设置",
        description: "配置文章链接、摘要、封面、可见性、标签和 SEO。",
        close: "关闭",
        save: "保存设置",
        slugLabel: "文章链接",
        slugPlaceholder: "留空时自动生成",
        summaryLabel: "摘要",
        summaryPlaceholder: "文章摘要...",
        coverLabel: "封面",
        visibilityLabel: "可见范围",
        tagsLabel: "标签",
        tagsPlaceholder: "选择或新建标签",
        chineseSeo: "中文 SEO",
        englishSeo: "英文 SEO",
        seoTitleLabel: "SEO 标题",
        seoDescriptionLabel: "SEO 描述",
        generateSeo: "AI 生成 SEO",
        generatingSeo: "生成中...",
        translationQueued: "英文译文尚未准备好，已将文章加入翻译队列。",
        allowCommentsLabel: "允许评论",
        pinnedLabel: "置顶",
        featuredLabel: "精选",
        publishedAtLabel: "发布时间",
        publishedAtHint: "导入旧文章时可手动设置原始发布时间。",
        saving: "保存中..."
      };
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

const initialActionState: ArticleActionState = {
  ok: false,
  message: "",
  fieldErrors: {}
};

export function ArticleSettingsDialog({
  article,
  tagOptions = [],
  open,
  onOpenChange,
  locale = "zh-CN"
}: {
  article: ArticleSettingsData;
  tagOptions?: Array<{ name: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale?: Locale;
}) {
  const text = labels(locale);
  const router = useRouter();
  const visOptions = contentVisibilityOptions(locale);
  const action = updateArticleSettingsAction.bind(null, article.id);
  const [state, formAction, isPending] = useActionState(action, initialActionState);
  const [isSeoPending, startSeoTransition] = useTransition();
  const formId = `article-settings-form-${article.id}`;
  const translationLocale = article.translationTargetLocale || "en";

  const initialTags = article.tags.flatMap((tag) => (tag?.name ? [tag.name] : []));
  const [selectedTags, setSelectedTags] = useState(initialTags);
  const [summary, setSummary] = useState(article.summary ?? "");
  const [visibility, setVisibility] = useState<string>(article.visibility);
  const [publishedAt, setPublishedAt] = useState(
    article.publishedAt ? new Date(article.publishedAt).toISOString().slice(0, 16) : ""
  );
  const [allowComments, setAllowComments] = useState(article.allowComments);
  const [pinned, setPinned] = useState(article.pinned);
  const [featured, setFeatured] = useState(article.featured);
  const [seoTitle, setSeoTitle] = useState(article.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(article.seoDescription ?? "");
  const [translationSeoTitle, setTranslationSeoTitle] = useState(article.targetTranslationSeoTitle ?? "");
  const [translationSeoDescription, setTranslationSeoDescription] = useState(article.targetTranslationSeoDescription ?? "");
  const [seoTarget, setSeoTarget] = useState<"zh-CN" | "en" | null>(null);
  const [seoMessage, setSeoMessage] = useState("");
  const [seoError, setSeoError] = useState("");
  const [submitLocked, setSubmitLocked] = useState(false);

  const tagSelectOptions = useMemo(
    () =>
      Array.from(new Set([...tagOptions.map((tag) => tag.name), ...selectedTags])).map((tag) => ({
        value: tag,
        label: tag
      })),
    [selectedTags, tagOptions]
  );

  useEffect(() => {
    if (state.ok) {
      onOpenChange(false);
      router.push(state.redirectTo ?? "/admin/articles");
      router.refresh();
    }
  }, [onOpenChange, router, state.ok, state.redirectTo]);

  useEffect(() => {
    if (!isPending) {
      setSubmitLocked(false);
    }
  }, [isPending]);

  const isSubmitting = isPending || submitLocked;

  function generateSeo(target: "zh-CN" | "en") {
    if (isSeoPending) {
      return;
    }

    setSeoTarget(target);
    setSeoMessage("");
    setSeoError("");

    if (target === "en" && !article.targetTranslationContentHtml?.trim()) {
      startSeoTransition(() => {
        void fetch("/api/admin/articles/translation-jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleIds: [article.id], locale: translationLocale })
        }).finally(() => {
          setSeoTarget(null);
          setSeoMessage(text.translationQueued);
        });
      });
      return;
    }

    const formData = new FormData();
    formData.set("title", target === "en" ? article.targetTranslationTitle || article.title : article.title);
    formData.set("summary", target === "en" ? article.targetTranslationSummary || "" : summary);
    formData.set("contentHtml", target === "en" ? article.targetTranslationContentHtml || "" : article.contentHtml);
    formData.set("targetLocale", target);

    startSeoTransition(() => {
      void generateArticleSeoAction(formData)
        .then((result) => {
          if (!result.ok) {
            setSeoError(result.message);
            return;
          }
          if (target === "en") {
            setTranslationSeoTitle(result.seoTitle ?? "");
            setTranslationSeoDescription(result.seoDescription ?? "");
          } else {
            setSeoTitle(result.seoTitle ?? "");
            setSeoDescription(result.seoDescription ?? "");
          }
          setSeoMessage(result.message);
        })
        .catch((error) => {
          setSeoError(error instanceof Error ? error.message : "AI SEO 生成失败。");
        })
        .finally(() => setSeoTarget(null));
    });
  }

  return (
    <Dialog
      open={open}
      title={`${text.title} - ${article.title}`}
      description={text.description}
      onOpenChange={onOpenChange}
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {text.close}
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            <Send className="mr-2 h-4 w-4" />
            {isSubmitting ? text.saving : text.save}
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        action={formAction}
        className="space-y-5"
        onSubmit={(event) => {
          if (isSubmitting) {
            event.preventDefault();
            return;
          }
          setSubmitLocked(true);
        }}
      >
        {state.message ? (
          <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>
            {state.message}
          </p>
        ) : null}
        {seoMessage ? <p className="text-sm text-emerald-600">{seoMessage}</p> : null}
        {seoError ? <p className="text-sm text-destructive">{seoError}</p> : null}
        <input type="hidden" name="publishedAt" value={publishedAt} />
        <input type="hidden" name="translationLocale" value={translationLocale} />
        <input type="hidden" name="translationSeoTitle" value={translationSeoTitle} />
        <input type="hidden" name="translationSeoDescription" value={translationSeoDescription} />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{text.slugLabel}</span>
          <Input name="slug" defaultValue={article.slug} placeholder={text.slugPlaceholder} />
          <FieldError messages={state.fieldErrors.slug} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{text.summaryLabel}</span>
          <Textarea name="summary" placeholder={text.summaryPlaceholder} value={summary} onChange={(event) => setSummary(event.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{text.coverLabel}</span>
          <ImageUploadField name="cover" defaultValue={article.cover ?? ""} showRandomOption />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{text.visibilityLabel}</span>
          <Select name="visibility" value={visibility} onValueChange={setVisibility} options={visOptions} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{text.tagsLabel}</span>
          <MultiSelect
            name="tagNames"
            value={selectedTags}
            onValueChange={setSelectedTags}
            options={tagSelectOptions}
            placeholder={text.tagsPlaceholder}
            allowCreate
          />
          <FieldError messages={state.fieldErrors.tagNames} />
        </label>
        <section className="space-y-3 rounded-md border bg-background/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{text.chineseSeo}</p>
            <Button type="button" variant="secondary" className="h-9 px-3" disabled={isSeoPending} onClick={() => generateSeo("zh-CN")}>
              <Sparkles className="mr-2 h-4 w-4" />
              {isSeoPending && seoTarget === "zh-CN" ? text.generatingSeo : text.generateSeo}
            </Button>
          </div>
          <Input name="seoTitle" placeholder={text.seoTitleLabel} value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} />
          <FieldError messages={state.fieldErrors.seoTitle} />
          <Textarea name="seoDescription" placeholder={text.seoDescriptionLabel} value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} />
          <FieldError messages={state.fieldErrors.seoDescription} />
        </section>
        <section className="space-y-3 rounded-md border bg-background/70 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-2 text-sm font-medium">
              <Languages className="h-4 w-4 text-primary" />
              {text.englishSeo}
            </p>
            <Button type="button" variant="secondary" className="h-9 px-3" disabled={isSeoPending} onClick={() => generateSeo("en")}>
              <Sparkles className="mr-2 h-4 w-4" />
              {isSeoPending && seoTarget === "en" ? text.generatingSeo : text.generateSeo}
            </Button>
          </div>
          <Input placeholder={text.seoTitleLabel} value={translationSeoTitle} onChange={(event) => setTranslationSeoTitle(event.target.value)} />
          <Textarea placeholder={text.seoDescriptionLabel} value={translationSeoDescription} onChange={(event) => setTranslationSeoDescription(event.target.value)} />
        </section>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{text.publishedAtLabel}</span>
          <Input
            type="datetime-local"
            value={publishedAt}
            onChange={(event) => setPublishedAt(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{text.publishedAtHint}</p>
          <FieldError messages={state.fieldErrors.publishedAt} />
        </label>
        <div className="grid gap-3 md:grid-cols-3">
          <ThemedCheckbox
            name="allowComments"
            label={text.allowCommentsLabel}
            checked={allowComments}
            onCheckedChange={setAllowComments}
          />
          <ThemedCheckbox
            name="pinned"
            label={text.pinnedLabel}
            checked={pinned}
            onCheckedChange={setPinned}
          />
          <ThemedCheckbox
            name="featured"
            label={text.featuredLabel}
            checked={featured}
            onCheckedChange={setFeatured}
          />
        </div>
      </form>
    </Dialog>
  );
}
