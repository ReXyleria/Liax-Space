"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArticleStatus, ContentVisibility } from "@prisma/client";
import { AlertTriangle, History, Save, Send, Settings, Sparkles } from "lucide-react";
import { BlockEditor } from "@/components/editor/block-editor/block-editor";
import { EditorToc } from "@/components/editor/editor-toc";
import { ArticleEditorErrorBoundary } from "@/components/forms/article-editor-error-boundary";
import type {
  ArticlePreviewDraft,
  PreviewSiteSettings
} from "@/components/forms/article-preview-overlay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import { ThemedCheckbox } from "@/components/ui/themed-checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/forms/image-upload-field";
import {
  createArticleAction,
  generateArticleSeoAction,
  restoreArticleVersionAction,
  updateArticleAction,
  type ArticleActionState
} from "@/features/articles/actions";
import { contentVisibilityOptions } from "@/lib/content-visibility";
import type { Locale } from "@/lib/i18n-messages";

type ArticleFormValue = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  cover: string | null;
  contentJson: unknown;
  contentHtml: string;
  status: ArticleStatus;
  visibility: ContentVisibility;
  allowComments: boolean;
  pinned: boolean;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  tags: Array<{ name: string }>;
};

type ArticleDraft = ArticlePreviewDraft;

type ArticleVersionValue = {
  id: string;
  version: number;
  title: string;
  slug: string;
  summary: string | null;
  cover: string | null;
  contentJson: unknown;
  contentHtml: string;
  status: ArticleStatus;
  visibility: ContentVisibility;
  tagNames: string[];
  createdAt: string;
  createdByName: string;
};

function labels(locale: Locale) {
  return locale === "en"
    ? {
        editArticle: "Edit article",
        createArticle: "New article",
        fillTitleHint: "Start by filling in the title",
        currentStatusPrefix: "Current status:",
        preview: "Preview",
        save: "Save",
        versions: "Version history",
        settings: "Settings",
        publish: "Publish",
        updatePublish: "Update and publish",
        draftDetected: "Detected a local draft from",
        restoreDraft: "Restore draft",
        ignore: "Ignore",
        articleSettings: "Article settings",
        articleSettingsDescription: "Configure the slug, summary, cover, visibility, tags, and SEO.",
        close: "Close",
        slugLabel: "Slug",
        slugPlaceholder: "Leave empty to generate a stable UUID slug",
        summaryLabel: "Summary",
        summaryPlaceholder: "Article summary...",
        coverLabel: "Cover",
        visibilityLabel: "Visibility",
        tagsLabel: "Tags",
        tagsPlaceholder: "Choose or create tags",
        seoTitleLabel: "SEO title",
        seoDescriptionLabel: "SEO 描述",
        allowCommentsLabel: "Allow comments",
        pinnedLabel: "Pinned",
        featuredLabel: "Featured",
        publishedAtLabel: "Publish date",
        publishedAtHint: "For importing old articles, set the original publish date.",
        versionHistoryDescription:
          "Load and review historical versions on demand. Restoring writes back to the current article.",
        loading: "Loading...",
        restoreVersion: "Restore",
        previewVersion: "Preview",
        confirmRestore: "Confirm restore",
        cancel: "Cancel",
        restoring: "Restoring...",
        restoreFailed: "Version restore failed.",
        noVersions: "Saving the article will create version records.",
        statusLabels: {
          [ArticleStatus.DRAFT]: "Draft",
          [ArticleStatus.PUBLISHED]: "Published",
          [ArticleStatus.ARCHIVED]: "Archived"
        }
      }
    : {
        editArticle: "编辑文章",
        createArticle: "新建文章",
        fillTitleHint: "先在标题行填写文章标题",
        currentStatusPrefix: "当前状态：",
        preview: "预览",
        save: "保存",
        versions: "版本历史",
        settings: "设置",
        publish: "发布",
        updatePublish: "更新发布",
        draftDetected: "检测到",
        restoreDraft: "恢复草稿",
        ignore: "忽略",
        articleSettings: "文章设置",
        articleSettingsDescription: "配置文章链接、摘要、封面、可见性、标签和 SEO。",
        close: "关闭",
        slugLabel: "文章链接",
        slugPlaceholder: "留空时自动生成稳定 UUID 链接",
        summaryLabel: "摘要",
        summaryPlaceholder: "文章摘要...",
        coverLabel: "封面",
        visibilityLabel: "可见性",
        tagsLabel: "标签",
        tagsPlaceholder: "选择或新建标签",
        seoTitleLabel: "SEO 标题",
        seoDescriptionLabel: "SEO description",
        allowCommentsLabel: "允许评论",
        pinnedLabel: "置顶",
        featuredLabel: "精选",
        publishedAtLabel: "发布时间",
        publishedAtHint: "导入旧文章时可手动设置原始发布时间。",
        versionHistoryDescription: "按需加载并查看文章历史版本。恢复会写回当前文章。",
        loading: "加载中...",
        restoreVersion: "恢复",
        previewVersion: "预览",
        confirmRestore: "确认恢复",
        cancel: "取消",
        restoring: "恢复中...",
        restoreFailed: "版本恢复失败。",
        noVersions: "保存文章后会生成版本记录。",
        statusLabels: {
          [ArticleStatus.DRAFT]: "草稿",
          [ArticleStatus.PUBLISHED]: "已发布",
          [ArticleStatus.ARCHIVED]: "已归档"
        }
      };
}

const initialArticleActionState: ArticleActionState = {
  ok: false,
  message: "",
  fieldErrors: {}
};

function visibilityOptions(locale: Locale) {
  return contentVisibilityOptions(locale);
  /*
  if (locale === "en") {
    return [
      { value: ContentVisibility.PUBLIC, label: "Public" },
      { value: ContentVisibility.LOGIN_REQUIRED, label: "Login required" },
      { value: ContentVisibility.SVIP_ONLY, label: "SVIP only" },
      { value: ContentVisibility.SSVIP_ONLY, label: "SSVIP only" },
      { value: ContentVisibility.Administer_ONLY, label: "Private" }
    ];
  }

  return [
    { value: ContentVisibility.PUBLIC, label: "公开" },
    { value: ContentVisibility.LOGIN_REQUIRED, label: "登录可见" },
    { value: ContentVisibility.SVIP_ONLY, label: "SVIP 可见" },
    { value: ContentVisibility.SSVIP_ONLY, label: "SSVIP 可见" },
    { value: ContentVisibility.Administer_ONLY, label: "私密" }
  ];
}

  */
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }
  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

function parseJsonDraft(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return { type: "doc", content: [] };
  }
}

function createShortUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replaceAll("-", "").slice(0, 16).toLowerCase();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    return Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  }

  return Math.random().toString(16).slice(2, 18).padEnd(16, "0");
}

export function ArticleEditorForm({
  article,
  tagOptions = [],
  versions: initialVersions = [],
  site,
  warnings = [],
  locale = "zh-CN"
}: {
  article?: ArticleFormValue | null;
  tagOptions?: Array<{ name: string }>;
  versions?: ArticleVersionValue[];
  site: PreviewSiteSettings;
  warnings?: string[];
  locale?: Locale;
}) {
  const text = labels(locale);
  void site;
  const articleVisibilityOptions = visibilityOptions(locale);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const returnToListRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<number | null>(null);
  const action = article ? updateArticleAction.bind(null, article.id) : createArticleAction;
  const draftKey = `article-draft:${article?.id ?? "new"}`;
  const [state, formAction, isPending] = useActionState<ArticleActionState, FormData>(
    action,
    initialArticleActionState
  );
  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? createShortUuid);
  const [status, setStatus] = useState<string>(article?.status ?? ArticleStatus.DRAFT);
  const [visibility, setVisibility] = useState<string>(article?.visibility ?? ContentVisibility.PUBLIC);
  const [publishedAt, setPublishedAt] = useState<string>(
    article?.publishedAt ? new Date(article.publishedAt).toISOString().slice(0, 16) : ""
  );
  const [summary, setSummary] = useState(article?.summary ?? "");
  const [cover, setCover] = useState(article?.cover ?? "");
  const [seoTitle, setSeoTitle] = useState(article?.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(article?.seoDescription ?? "");
  const [allowComments, setAllowComments] = useState(article?.allowComments ?? true);
  const [pinned, setPinned] = useState(article?.pinned ?? false);
  const [featured, setFeatured] = useState(article?.featured ?? false);
  const [pendingDraft, setPendingDraft] = useState<ArticleDraft | null>(null);
  const [editorInitial, setEditorInitial] = useState({
    html: article?.contentHtml ?? "",
    json: article?.contentJson
  });
  const [editorKey, setEditorKey] = useState(0);
  const initialSelectedTags = article?.tags.flatMap((tag) => (tag?.name ? [tag.name] : [])) ?? [];
  const [selectedTags, setSelectedTags] = useState(initialSelectedTags);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<ArticleVersionValue[]>(initialVersions);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionPreview, setVersionPreview] = useState<ArticleVersionValue | null>(null);
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState("");
  const [isRestoring, startRestoreTransition] = useTransition();
  const [isGeneratingSeo, startSeoTransition] = useTransition();
  const [submitLocked, setSubmitLocked] = useState(false);
  const [seoMessage, setSeoMessage] = useState("");
  const [seoError, setSeoError] = useState("");

  const tagSelectOptions = useMemo(
    () => Array.from(new Set([...tagOptions.map((tag) => tag.name), ...selectedTags]))
      .map((tag) => ({ value: tag, label: tag })),
    [selectedTags, tagOptions]
  );
  const collectDraft = useCallback((): ArticleDraft | null => {
    const form = formRef.current;
    if (!form) {
      return null;
    }
    const formData = new FormData(form);
    return {
      title,
      slug,
      summary,
      cover,
      contentHtml: String(formData.get("contentHtml") ?? ""),
      contentJson: String(formData.get("contentJson") ?? JSON.stringify({ type: "doc", content: [] })),
      status,
      visibility,
      tagNames: selectedTags.join(", "),
      seoTitle,
      seoDescription,
      publishedAt,
      allowComments,
      pinned,
      featured,
      savedAt: Date.now()
    };
  }, [
    allowComments,
    cover,
    featured,
    pinned,
    publishedAt,
    selectedTags,
    seoDescription,
    seoTitle,
    slug,
    status,
    summary,
    title,
    visibility
  ]);

  const scheduleDraftSave = useCallback(() => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
    saveTimer.current = window.setTimeout(() => {
      const draft = collectDraft();
      if (draft) {
        window.localStorage.setItem(draftKey, JSON.stringify(draft));
      }
    }, 450);
  }, [collectDraft, draftKey]);

  const restoreDraft = useCallback((draft: ArticleDraft) => {
    setTitle(draft.title);
    setSlug(draft.slug);
    setSummary(draft.summary);
    setCover(draft.cover);
    setSeoTitle(draft.seoTitle);
    setSeoDescription(draft.seoDescription);
    setAllowComments(draft.allowComments);
    setPinned(draft.pinned);
    setFeatured(draft.featured);
    setPublishedAt(draft.publishedAt);
    setEditorInitial({ html: draft.contentHtml, json: parseJsonDraft(draft.contentJson) });
    setStatus(draft.status);
    setVisibility(draft.visibility);
    setSelectedTags(draft.tagNames.split(",").map((tag) => tag.trim()).filter(Boolean));
    setEditorKey((current) => current + 1);
    setPendingDraft(null);
  }, []);

  function submitWithStatus(nextStatus: ArticleStatus, returnToList = false) {
    const form = formRef.current;
    if (!form || isPending || submitLocked) {
      return;
    }
    if (!form.reportValidity()) {
      return;
    }
    const statusField = form.elements.namedItem("status");
    if (statusField instanceof HTMLInputElement) {
      statusField.value = nextStatus;
    }
    if (returnToListRef.current) {
      returnToListRef.current.value = returnToList ? "1" : "0";
    }
    setSubmitLocked(true);
    setStatus(nextStatus);
    form.requestSubmit();
  }

  function publishArticle() {
    if (!article) {
      setSettingsOpen(true);
      return;
    }

    submitWithStatus(ArticleStatus.PUBLISHED, true);
  }

  async function loadVersions() {
    if (!article || versionsLoading || versions.length) {
      return;
    }
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/articles/${article.id}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions ?? []);
      }
    } finally {
      setVersionsLoading(false);
    }
  }

  function handleGenerateSeo() {
    const draft = collectDraft();
    if (!draft || isGeneratingSeo) {
      return;
    }

    setSeoError("");
    setSeoMessage("");
    const formData = new FormData();
    formData.set("title", draft.title);
    formData.set("summary", draft.summary);
    formData.set("contentHtml", draft.contentHtml);

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
          scheduleDraftSave();
        })
        .catch((error) => {
          setSeoError(error instanceof Error ? error.message : "AI SEO 生成失败。");
        });
    });
  }

  function handleRestore(versionId: string) {
    if (!article) {
      return;
    }
    setRestoreError("");
    startRestoreTransition(() => {
      void restoreArticleVersionAction(article.id, versionId).catch((error) => {
        setRestoreError(error instanceof Error ? error.message : text.restoreFailed);
      });
    });
  }

  useEffect(() => {
    const raw = window.localStorage.getItem(draftKey);
    if (!raw) {
      return;
    }
    try {
      const draft = JSON.parse(raw) as ArticleDraft;
      if (draft.savedAt) {
        setPendingDraft(draft);
      }
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  useEffect(() => {
    if (state.ok) {
      window.localStorage.removeItem(draftKey);
    }
    if (state.ok && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [draftKey, router, state.ok, state.redirectTo]);

  useEffect(() => {
    if (!isPending) {
      setSubmitLocked(false);
    }
  }, [isPending]);

  useEffect(() => {
    if (Object.keys(state.fieldErrors).length) {
      setSettingsOpen(true);
    }
  }, [state.fieldErrors]);

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, []);

  useEffect(() => () => {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current);
    }
  }, []);

  const isPublished = status === ArticleStatus.PUBLISHED;
  const isSubmittingArticle = isPending || submitLocked;
  const statusText = text.statusLabels[status as ArticleStatus] ?? status;
  const dateLocale = locale === "en" ? "en-US" : "zh-CN";

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]"
        onInput={scheduleDraftSave}
        onChange={scheduleDraftSave}
      >
        <input type="hidden" name="status" value={status} readOnly />
        <input type="hidden" name="slug" value={slug} readOnly />
        <input type="hidden" name="summary" value={summary} readOnly />
        <input type="hidden" name="cover" value={cover} readOnly />
        <input type="hidden" name="visibility" value={visibility} readOnly />
        {selectedTags.map((tagName) => (
          <input key={tagName} type="hidden" name="tagNames" value={tagName} readOnly />
        ))}
        <input type="hidden" name="seoTitle" value={seoTitle} readOnly />
        <input type="hidden" name="seoDescription" value={seoDescription} readOnly />
        <input type="hidden" name="publishedAt" value={publishedAt} readOnly />
        {allowComments ? <input type="hidden" name="allowComments" value="on" readOnly /> : null}
        {pinned ? <input type="hidden" name="pinned" value="on" readOnly /> : null}
        {featured ? <input type="hidden" name="featured" value="on" readOnly /> : null}
        <input ref={returnToListRef} type="hidden" name="returnToList" defaultValue="0" />
        <div className="space-y-6">
          {warnings.length ? (
            <Card className="border-amber-300 bg-amber-50/80 p-4 text-amber-950">
              <div className="flex gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {locale === "en" ? "Some optional editor data could not be loaded." : "部分可选编辑器数据加载失败。"}
                  </p>
                  <ul className="space-y-1 text-xs">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          ) : null}
          {pendingDraft ? (
            <Card className="p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">
                  {text.draftDetected} {new Date(pendingDraft.savedAt).toLocaleString(dateLocale)}.
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => restoreDraft(pendingDraft)}>
                    {text.restoreDraft}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      window.localStorage.removeItem(draftKey);
                      setPendingDraft(null);
                    }}
                  >
                    {text.ignore}
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="border-b bg-muted/35">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <CardTitle>{article ? text.editArticle : text.createArticle}</CardTitle>
                  <p className="mt-2 truncate text-sm text-muted-foreground">
                    {title || text.fillTitleHint} · {text.currentStatusPrefix}{statusText}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => submitWithStatus(status as ArticleStatus)} disabled={isSubmittingArticle}>
                    <Save className="mr-2 h-4 w-4" />
                    {text.save}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      void loadVersions();
                      setVersionsOpen(true);
                    }}
                    disabled={!article}
                  >
                    <History className="mr-2 h-4 w-4" />
                    {text.versions}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setSettingsOpen(true)}>
                    <Settings className="mr-2 h-4 w-4" />
                    {text.settings}
                  </Button>
                  <Button type="button" onClick={publishArticle} disabled={isSubmittingArticle}>
                    <Send className="mr-2 h-4 w-4" />
                    {isPublished ? text.updatePublish : text.publish}
                  </Button>
                </div>
              </div>
              {state.message ? (
                <p className={state.ok ? "mt-3 text-sm text-emerald-600" : "mt-3 text-sm text-destructive"}>
                  {state.message}
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="pt-6">
              <ArticleEditorErrorBoundary>
                <BlockEditor
                  key={editorKey}
                  title={title}
                  initialHtml={editorInitial.html}
                  initialJson={editorInitial.json}
                  onTitleChange={setTitle}
                  onContentChange={scheduleDraftSave}
                />
              </ArticleEditorErrorBoundary>
              <FieldError messages={state.fieldErrors.title} />
              <FieldError messages={state.fieldErrors.contentHtml ?? state.fieldErrors.contentJson} />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <EditorToc />
        </aside>

        <Dialog
          open={settingsOpen}
          title={text.articleSettings}
          description={text.articleSettingsDescription}
          onOpenChange={setSettingsOpen}
          footer={
            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="secondary" onClick={() => setSettingsOpen(false)}>
                {text.close}
              </Button>
              <Button type="button" onClick={() => submitWithStatus(ArticleStatus.PUBLISHED, true)} disabled={isSubmittingArticle}>
                <Send className="mr-2 h-4 w-4" />
                {isPublished ? text.updatePublish : text.publish}
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{text.slugLabel}</span>
              <Input
                name="slug-preview"
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value);
                  scheduleDraftSave();
                }}
                placeholder={text.slugPlaceholder}
              />
              <FieldError messages={state.fieldErrors.slug} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{text.summaryLabel}</span>
              <Textarea
                name="summary-preview"
                placeholder={text.summaryPlaceholder}
                value={summary}
                onChange={(event) => {
                  setSummary(event.target.value);
                  scheduleDraftSave();
                }}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{text.coverLabel}</span>
              <ImageUploadField
                name="cover-preview"
                value={cover}
                showRandomOption
                onValueChange={(nextCover) => {
                  setCover(nextCover);
                  scheduleDraftSave();
                }}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{locale === "en" ? text.visibilityLabel : "可见范围"}</span>
              <Select
                name="visibility-preview"
                value={visibility}
                onValueChange={(nextVisibility) => {
                  setVisibility(nextVisibility);
                  scheduleDraftSave();
                }}
                options={articleVisibilityOptions}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{text.tagsLabel}</span>
              <MultiSelect
                name="tagNames-preview"
                value={selectedTags}
                onValueChange={(nextTags) => {
                  setSelectedTags(nextTags);
                  scheduleDraftSave();
                }}
                options={tagSelectOptions}
                placeholder={text.tagsPlaceholder}
                allowCreate
              />
              <FieldError messages={state.fieldErrors.tagNames} />
            </label>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">SEO</p>
                  <p className="text-xs text-muted-foreground">使用翻译页的 AI 接口配置生成，生成后可继续手动修改。</p>
                </div>
                <Button type="button" variant="secondary" onClick={handleGenerateSeo} disabled={isGeneratingSeo}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {isGeneratingSeo ? "生成中..." : "AI 生成 SEO"}
                </Button>
              </div>
              <div className="space-y-3">
                <Input
                  name="seoTitle-preview"
                  placeholder={text.seoTitleLabel}
                  value={seoTitle}
                  onChange={(event) => {
                    setSeoTitle(event.target.value);
                    scheduleDraftSave();
                  }}
                />
                <FieldError messages={state.fieldErrors.seoTitle} />
                <Textarea
                  name="seoDescription-preview"
                  placeholder={text.seoDescriptionLabel}
                  value={seoDescription}
                  onChange={(event) => {
                    setSeoDescription(event.target.value);
                    scheduleDraftSave();
                  }}
                />
                <FieldError messages={state.fieldErrors.seoDescription} />
                {seoError ? <p className="text-xs text-destructive">{seoError}</p> : null}
                {seoMessage ? <p className="text-xs text-emerald-700">{seoMessage}</p> : null}
              </div>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{text.publishedAtLabel}</span>
              <Input
                type="datetime-local"
                value={publishedAt}
                onChange={(event) => {
                  setPublishedAt(event.target.value);
                  scheduleDraftSave();
                }}
              />
              <p className="text-xs text-muted-foreground">{text.publishedAtHint}</p>
              <FieldError messages={state.fieldErrors.publishedAt} />
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <ThemedCheckbox
                name="allowComments-preview"
                label={text.allowCommentsLabel}
                checked={allowComments}
                onCheckedChange={(checked) => {
                  setAllowComments(checked);
                  scheduleDraftSave();
                }}
              />
              <ThemedCheckbox
                name="pinned-preview"
                label={text.pinnedLabel}
                checked={pinned}
                onCheckedChange={(checked) => {
                  setPinned(checked);
                  scheduleDraftSave();
                }}
              />
              <ThemedCheckbox
                name="featured-preview"
                label={text.featuredLabel}
                checked={featured}
                onCheckedChange={(checked) => {
                  setFeatured(checked);
                  scheduleDraftSave();
                }}
              />
            </div>
          </div>
        </Dialog>

        <Dialog
          open={versionsOpen}
          title={text.versions}
          description={text.versionHistoryDescription}
          onOpenChange={(open) => {
            if (!open) {
              setVersionsOpen(false);
              setVersionPreview(null);
              setRestoreConfirm(null);
              setRestoreError("");
            }
          }}
        >
          <div className="space-y-3">
            {restoreError ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{restoreError}</p> : null}
            {versionsLoading ? (
              <p className="py-4 text-center text-sm text-muted-foreground">{text.loading}</p>
            ) : versions.length ? (
              versions.map((version) => (
                <div key={version.id} className="rounded-md border bg-background/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">版本 {version.version} · {version.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {new Date(version.createdAt).toLocaleString("zh-CN")} · {version.createdByName}
                      </p>
                      {versionPreview?.id === version.id ? (
                        <div className="mt-3 max-h-64 overflow-y-auto rounded border bg-muted/30 p-3 text-sm">
                          <div
                            className="prose-content text-sm"
                            dangerouslySetInnerHTML={{ __html: version.contentHtml }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" variant="secondary" className="h-8 px-3 text-xs" onClick={() => {
                      setVersionPreview(version);
                    }}>
                      {text.previewVersion}
                    </Button>
                    {article && restoreConfirm === version.id ? (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="danger"
                          className="h-8 px-3 text-xs"
                          onClick={() => handleRestore(version.id)}
                          disabled={isRestoring}
                        >
                          {isRestoring ? text.restoring : text.confirmRestore}
                        </Button>
                        <Button type="button" variant="ghost" className="h-8 px-3 text-xs" onClick={() => setRestoreConfirm(null)}>
                          {text.cancel}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-3 text-xs"
                        onClick={() => setRestoreConfirm(version.id)}
                      >
                        {text.restoreVersion}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                {text.noVersions}
              </p>
            )}
          </div>
        </Dialog>
      </form>
    </>
  );
}
