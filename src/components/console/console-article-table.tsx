"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArticleTranslationJobStatus } from "@prisma/client";
import { Check, Languages, RotateCcw } from "lucide-react";
import { ArticleActionsMenu, type ArticleRowData } from "@/components/console/article-actions-menu";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { articleStatusLabel } from "@/lib/article-status";
import { contentVisibilityBadgeClass, contentVisibilityLabel } from "@/lib/content-visibility";
import type { Locale } from "@/lib/i18n-messages";
import { cn, formatDate } from "@/lib/utils";

type TranslationJob = {
  id: string;
  articleId: string;
  locale: string;
  status: ArticleTranslationJobStatus;
  progress: number;
  completedUnits: number;
  totalUnits: number;
  progressMessage: string | null;
  error: string | null;
};

const activeStatuses = new Set<ArticleTranslationJobStatus>([
  ArticleTranslationJobStatus.QUEUED,
  ArticleTranslationJobStatus.RUNNING
]);

function labels(locale: Locale) {
  return locale === "en"
    ? {
        queued: "Queued",
        running: "Translating",
        succeeded: "Completed",
        failed: "Failed",
        canceled: "Canceled",
        idle: "Idle",
        retry: "Retry",
        chinese: "Simplified Chinese",
        english: "English",
        responseInvalid: "Invalid response format.",
        loadFailed: "Failed to load translation jobs.",
        selectAtLeastOne: "Select at least one article.",
        enqueueFailed: "Failed to enqueue translation jobs.",
        enqueued: "Translation jobs were queued.",
        retryFailed: "Failed to retry translation job.",
        selectArticles: "Select articles",
        selected: "selected",
        translateSelected: "Translate selected",
        queueing: "Queueing...",
        translated: "Translated",
        untranslated: "Not translated",
        chooseArticle: "Select"
      }
    : {
        queued: "队列中",
        running: "翻译中",
        succeeded: "已完成",
        failed: "失败",
        canceled: "已取消",
        idle: "空闲",
        retry: "重试",
        chinese: "简体中文",
        english: "英文",
        responseInvalid: "响应格式无效。",
        loadFailed: "翻译任务加载失败。",
        selectAtLeastOne: "请至少选择一篇文章。",
        enqueueFailed: "翻译任务加入队列失败。",
        enqueued: "翻译任务已加入队列。",
        retryFailed: "重试翻译任务失败。",
        selectArticles: "选择文章",
        selected: "已选择",
        translateSelected: "翻译选中",
        queueing: "排队中...",
        translated: "已翻译",
        untranslated: "未翻译",
        chooseArticle: "选择"
      };
}

const progressMessageLabels: Record<string, string> = {
  Queued: "队列中",
  "Queued for retry": "已重新排队",
  "Recovered stale running job": "已恢复停滞任务",
  "Starting translation": "开始翻译",
  "Translation queued": "翻译已排队",
  "Preparing translation": "准备翻译",
  "Metadata translated": "元数据已翻译",
  "Sending translation request": "正在发送翻译请求",
  "Translation complete": "翻译完成",
  "Translation already current": "译文已是最新",
  队列中: "队列中",
  已重新排队: "已重新排队",
  已恢复停滞任务: "已恢复停滞任务",
  开始翻译: "开始翻译",
  翻译完成: "翻译完成"
};

function jobKey(articleId: string, locale: string) {
  return `${articleId}:${locale}`;
}

function statusLabel(locale: Locale, status?: ArticleTranslationJobStatus) {
  const text = labels(locale);
  switch (status) {
    case ArticleTranslationJobStatus.QUEUED:
      return text.queued;
    case ArticleTranslationJobStatus.RUNNING:
      return text.running;
    case ArticleTranslationJobStatus.SUCCEEDED:
      return text.succeeded;
    case ArticleTranslationJobStatus.FAILED:
      return text.failed;
    case ArticleTranslationJobStatus.CANCELED:
      return text.canceled;
    default:
      return text.idle;
  }
}

function statusClass(status?: ArticleTranslationJobStatus) {
  switch (status) {
    case ArticleTranslationJobStatus.SUCCEEDED:
      return "bg-emerald-50 text-emerald-700";
    case ArticleTranslationJobStatus.FAILED:
    case ArticleTranslationJobStatus.CANCELED:
      return "bg-destructive/10 text-destructive";
    case ArticleTranslationJobStatus.QUEUED:
    case ArticleTranslationJobStatus.RUNNING:
      return "bg-primary/10 text-primary";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function languageLabel(locale: Locale, value: string) {
  const text = labels(locale);
  if (value === "zh-CN") return text.chinese;
  if (value === "en") return text.english;
  return value;
}

type ArticleLanguageStatus =
  NonNullable<ArticleRowData["languageStatuses"]>[keyof NonNullable<ArticleRowData["languageStatuses"]>];

function languageShortLabel(value: "zh-CN" | "en") {
  return value === "zh-CN" ? "中文" : "English";
}

function languageStatusClass(status?: ArticleLanguageStatus) {
  if (status?.isSource || status?.ready) {
    return "bg-emerald-500";
  }
  if (status?.status === "TRANSLATING") {
    return "bg-amber-500";
  }
  return "bg-red-500";
}

function languageStatusTitle(locale: Locale, status: ArticleLanguageStatus | undefined) {
  const sourceReady = locale === "en" ? "source" : "原文";
  const ready = locale === "en" ? "ready" : "可用";
  const notReady = locale === "en" ? "not ready" : "未就绪";

  if (!status) {
    return notReady;
  }
  if (status.isSource) {
    return `${languageShortLabel(status.locale)}: ${sourceReady}`;
  }
  if (status.ready) {
    return `${languageShortLabel(status.locale)}: ${ready}`;
  }
  return `${languageShortLabel(status.locale)}: ${status.error || status.status || notReady}`;
}

function LanguageIndicator({
  locale,
  status,
  displayLocale
}: {
  locale: Locale;
  status: ArticleLanguageStatus | undefined;
  displayLocale: "zh-CN" | "en";
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2 py-1 text-xs text-muted-foreground"
      title={languageStatusTitle(locale, status)}
    >
      <span className={cn("h-2.5 w-2.5 rounded-full", languageStatusClass(status))} />
      {languageShortLabel(displayLocale)}
    </span>
  );
}

function localizeProgressMessage(value: string | null | undefined) {
  if (!value) return "";
  if (progressMessageLabels[value]) return progressMessageLabels[value];
  const chunkMatch = value.match(/^Translated (\d+)\/(\d+) content chunks$/);
  if (chunkMatch) {
    return `已翻译 ${chunkMatch[1]}/${chunkMatch[2]} 个正文分段`;
  }
  return value;
}

async function readJson(response: Response, fallback: string) {
  return response.json().catch(() => ({ ok: false, message: fallback }));
}

function SelectionControl({
  checked,
  onCheckedChange,
  label,
  compact = false
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <label
      className={cn(
        "group inline-flex cursor-pointer items-center gap-2 rounded-md text-sm font-medium transition hover:-translate-y-0.5 hover:bg-primary/5 active:translate-y-0 active:scale-[0.99]",
        checked && "text-primary",
        compact ? "h-9 w-9 justify-center p-0" : "h-10 bg-muted/55 px-3"
      )}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(event) => onCheckedChange(event.currentTarget.checked)}
        aria-label={label}
      />
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-md border border-input bg-card text-transparent transition",
          checked && "border-primary bg-primary text-primary-foreground"
        )}
      >
        <Check className="h-3.5 w-3.5" />
      </span>
      {compact ? null : <span>{label}</span>}
    </label>
  );
}

export function ConsoleArticleTable({
  articles,
  tagOptions,
  locale,
  defaultTargetLocale
}: {
  articles: ArticleRowData[];
  tagOptions: Array<{ name: string }>;
  locale: Locale;
  defaultTargetLocale: string;
}) {
  const text = labels(locale);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [targetLocale, setTargetLocale] = useState(defaultTargetLocale || "en");
  const [jobsByKey, setJobsByKey] = useState<Record<string, TranslationJob>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const articleIds = useMemo(() => articles.map((article) => article.id), [articles]);
  const allSelected = selectedIds.length === articles.length && articles.length > 0;
  const hasActiveJobs = Object.values(jobsByKey).some((job) => activeStatuses.has(job.status));
  const languageOptions = useMemo(() => {
    const values = Array.from(new Set([defaultTargetLocale || "en", "en", "zh-CN"]));
    return values.map((value) => ({ value, label: languageLabel(locale, value) }));
  }, [defaultTargetLocale, locale]);

  const loadJobs = useCallback(async () => {
    if (!articleIds.length) {
      return;
    }

    const response = await fetch(`/api/console/articles/translation-jobs?articleIds=${articleIds.join(",")}`, {
      cache: "no-store"
    });
    const payload = await readJson(response, text.responseInvalid);
    if (!response.ok || !payload.ok) {
      setMessage(payload.message ?? text.loadFailed);
      return;
    }

    const nextJobs: Record<string, TranslationJob> = {};
    for (const job of (payload.jobs ?? []) as TranslationJob[]) {
      nextJobs[jobKey(job.articleId, job.locale)] = job;
    }
    setJobsByKey(nextJobs);
  }, [articleIds, text.loadFailed, text.responseInvalid]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!hasActiveJobs) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadJobs();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs, loadJobs]);

  function toggleArticle(articleId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, articleId])) : current.filter((id) => id !== articleId)
    );
  }

  async function enqueueSelected() {
    if (!selectedIds.length) {
      setMessage(text.selectAtLeastOne);
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/console/articles/translation-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleIds: selectedIds, locale: targetLocale })
      });
      const payload = await readJson(response, text.responseInvalid);
      if (!response.ok || !payload.ok) {
        setMessage(payload.message ?? text.enqueueFailed);
        return;
      }
      setMessage(text.enqueued);
      await loadJobs();
    } finally {
      setBusy(false);
    }
  }

  async function retryJob(jobId: string) {
    setMessage("");
    const response = await fetch(`/api/console/articles/translation-jobs/${jobId}/retry`, { method: "POST" });
    const payload = await readJson(response, text.responseInvalid);
    if (!response.ok || !payload.ok) {
      setMessage(payload.message ?? text.retryFailed);
      return;
    }
    await loadJobs();
  }

  return (
    <Card className="overflow-visible">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
        <SelectionControl
          checked={allSelected}
          onCheckedChange={(checked) => setSelectedIds(checked ? articleIds : [])}
          label={selectedIds.length ? `${text.selected} ${selectedIds.length} 篇` : text.selectArticles}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            name="translationTargetLocale"
            value={targetLocale}
            onValueChange={setTargetLocale}
            options={languageOptions}
            className="min-w-40"
          />
          <Button type="button" disabled={busy || !selectedIds.length} onClick={enqueueSelected}>
            <Languages className="mr-2 h-4 w-4" />
            {busy ? text.queueing : text.translateSelected}
          </Button>
        </div>
      </div>
      {message ? <p className="border-b px-4 py-3 text-sm text-muted-foreground">{message}</p> : null}
      <div className="divide-y">
        {articles.map((article) => {
          const activeJob = jobsByKey[jobKey(article.id, targetLocale)];
          const progress = Math.max(0, Math.min(100, activeJob?.progress ?? 0));

          return (
            <div
              key={article.id}
              className="grid gap-3 p-5 transition hover:bg-muted/60 md:grid-cols-[28px_minmax(0,1fr)_120px_140px_140px_180px_64px] md:items-center"
            >
              <SelectionControl
                checked={selectedIds.includes(article.id)}
                onCheckedChange={(checked) => toggleArticle(article.id, checked)}
                label={`${text.chooseArticle} ${article.title}`}
                compact
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/console/articles/${article.id}/edit`} className="font-medium hover:text-primary">
                    {article.title}
                  </Link>
                  <LanguageIndicator
                    locale={locale}
                    displayLocale="zh-CN"
                    status={article.languageStatuses?.["zh-CN"]}
                  />
                  <LanguageIndicator
                    locale={locale}
                    displayLocale="en"
                    status={article.languageStatuses?.en}
                  />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{article.slug}</p>
              </div>
              <span className="text-sm text-muted-foreground">{articleStatusLabel(locale, article.status)}</span>
              <span
                className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${contentVisibilityBadgeClass(article.visibility)}`}
              >
                {contentVisibilityLabel(locale, article.visibility)}
              </span>
              <span className="text-sm text-muted-foreground">{formatDate(article.publishedAt ?? article.createdAt)}</span>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(activeJob?.status)}`}>
                    {statusLabel(locale, activeJob?.status)}
                  </span>
                  {activeJob?.status === ArticleTranslationJobStatus.FAILED ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      onClick={() => retryJob(activeJob.id)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {text.retry}
                    </button>
                  ) : null}
                </div>
                {activeJob ? (
                  <>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {activeJob.error || localizeProgressMessage(activeJob.progressMessage) || `${progress}%`}
                    </p>
                  </>
                ) : null}
              </div>
              <ArticleActionsMenu article={article} tagOptions={tagOptions} locale={locale} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
