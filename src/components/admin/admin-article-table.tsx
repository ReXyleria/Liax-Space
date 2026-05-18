"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArticleTranslationJobStatus } from "@prisma/client";
import { Check, Languages, RotateCcw } from "lucide-react";
import { ArticleActionsMenu, type ArticleRowData } from "@/components/admin/article-actions-menu";
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

function jobKey(articleId: string, locale: string) {
  return `${articleId}:${locale}`;
}

function statusLabel(status?: ArticleTranslationJobStatus) {
  switch (status) {
    case ArticleTranslationJobStatus.QUEUED:
      return "Queued";
    case ArticleTranslationJobStatus.RUNNING:
      return "Translating";
    case ArticleTranslationJobStatus.SUCCEEDED:
      return "Translated";
    case ArticleTranslationJobStatus.FAILED:
      return "Failed";
    case ArticleTranslationJobStatus.CANCELED:
      return "Canceled";
    default:
      return "Idle";
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

async function readJson(response: Response) {
  return response.json().catch(() => ({ ok: false, message: "Invalid response." }));
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
        "group inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background/80 text-sm font-medium shadow-sm shadow-slate-950/5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 active:translate-y-0 active:scale-[0.99]",
        checked && "border-primary/50 bg-primary/10 text-primary",
        compact ? "h-9 w-9 justify-center p-0" : "px-3 py-2"
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

export function AdminArticleTable({
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
    return values.map((value) => ({
      value,
      label: value === "zh-CN" ? "简体中文" : value === "en" ? "English" : value
    }));
  }, [defaultTargetLocale]);

  const loadJobs = useCallback(async () => {
    if (!articleIds.length) {
      return;
    }

    const response = await fetch(`/api/admin/articles/translation-jobs?articleIds=${articleIds.join(",")}`, {
      cache: "no-store"
    });
    const payload = await readJson(response);
    if (!response.ok || !payload.ok) {
      setMessage(payload.message ?? "Failed to load translation jobs.");
      return;
    }

    const nextJobs: Record<string, TranslationJob> = {};
    for (const job of (payload.jobs ?? []) as TranslationJob[]) {
      nextJobs[jobKey(job.articleId, job.locale)] = job;
    }
    setJobsByKey(nextJobs);
  }, [articleIds]);

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
      setMessage("Select at least one article.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/articles/translation-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleIds: selectedIds, locale: targetLocale })
      });
      const payload = await readJson(response);
      if (!response.ok || !payload.ok) {
        setMessage(payload.message ?? "Failed to enqueue translation jobs.");
        return;
      }
      setMessage("Translation jobs queued.");
      await loadJobs();
    } finally {
      setBusy(false);
    }
  }

  async function retryJob(jobId: string) {
    setMessage("");
    const response = await fetch(`/api/admin/articles/translation-jobs/${jobId}/retry`, { method: "POST" });
    const payload = await readJson(response);
    if (!response.ok || !payload.ok) {
      setMessage(payload.message ?? "Failed to retry translation job.");
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
          label={selectedIds.length ? `${selectedIds.length} selected` : "Select articles"}
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
            {busy ? "Queueing..." : "Translate selected"}
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
                label={`Select ${article.title}`}
                compact
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/articles/${article.id}/edit`} className="font-medium hover:text-primary">
                    {article.title}
                  </Link>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      article.translationReady ? "bg-emerald-500" : "bg-red-500"
                    }`}
                    title={
                      article.translationReady
                        ? `Translated: ${article.translationTargetLocale}`
                        : `Not translated: ${article.translationTargetLocale}`
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    {article.translationReady ? "Translated" : "Not translated"}
                  </span>
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
                    {statusLabel(activeJob?.status)}
                  </span>
                  {activeJob?.status === ArticleTranslationJobStatus.FAILED ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      onClick={() => retryJob(activeJob.id)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Retry
                    </button>
                  ) : null}
                </div>
                {activeJob ? (
                  <>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {activeJob.error || activeJob.progressMessage || `${progress}%`}
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
