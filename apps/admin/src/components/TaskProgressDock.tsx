import { useEffect, useMemo, useState, type ReactElement } from "react";

import {
  translationApi,
  type TranslationJob,
  type TranslationJobProgressItem,
  type TranslationJobStatus
} from "../api/translationApi";
import { useT } from "../i18n/useT";

export type TaskProgressDockProps = {
  enabled: boolean;
};

type TaskProgressRow = {
  completed: number;
  id: string;
  index: number;
  isSegment: boolean;
  jobId: number;
  jobKind: TranslationJob["kind"];
  progressPercent: number;
  status: TranslationJobStatus;
  total: number;
};

const taskPollIntervalMs = 2_500;

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function readDisplayProgress(status: TranslationJobStatus, progressPercent: number): number {
  if (status === "queued") {
    return Math.max(3, clampProgress(progressPercent));
  }

  if (status === "running") {
    return Math.max(8, clampProgress(progressPercent));
  }

  return clampProgress(progressPercent);
}

function createFallbackProgressItem(job: TranslationJob): TranslationJobProgressItem {
  return {
    id: `${job.id}:job`,
    index: 1,
    progressPercent: job.progressPercent,
    status: job.status,
    total: Math.max(1, job.progressTotal)
  };
}

function buildTaskRows(jobs: TranslationJob[]): TaskProgressRow[] {
  return jobs.flatMap((job) => {
    const progressItems = job.progressItems?.length ? job.progressItems : [createFallbackProgressItem(job)];
    const showSegmentRows = job.kind === "translate" && progressItems.length > 1;

    return progressItems.map((item) => ({
      completed: job.progressCompleted,
      id: item.id,
      index: item.index,
      isSegment: showSegmentRows,
      jobId: job.id,
      jobKind: job.kind,
      progressPercent: item.progressPercent,
      status: item.status,
      total: item.total
    }));
  });
}

function isActiveStatus(status: TranslationJobStatus): boolean {
  return status === "queued" || status === "running";
}

export function TaskProgressDock({ enabled }: TaskProgressDockProps): ReactElement | null {
  const t = useT();
  const [jobs, setJobs] = useState<TranslationJob[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const taskRows = useMemo(() => buildTaskRows(jobs), [jobs]);
  const activeCount = Math.max(1, taskRows.filter((row) => isActiveStatus(row.status)).length);
  const taskSummary = useMemo(
    () => t("task.activeCount").replace("{count}", String(activeCount)),
    [activeCount, t]
  );

  useEffect(() => {
    if (!enabled) {
      setJobs([]);
      setIsOpen(false);
      return;
    }

    let isMounted = true;

    async function refreshJobs(): Promise<void> {
      try {
        const response = await translationApi.listActiveJobs();

        if (isMounted) {
          setJobs(response.jobs);
          if (response.jobs.length === 0) {
            setIsOpen(false);
          }
        }
      } catch {
        if (isMounted) {
          setJobs([]);
          setIsOpen(false);
        }
      }
    }

    void refreshJobs();
    const intervalId = window.setInterval(() => {
      void refreshJobs();
    }, taskPollIntervalMs);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [enabled]);

  if (!enabled || jobs.length === 0) {
    return null;
  }

  return (
    <aside className="admin-task-dock" aria-label={t("task.panelTitle")}>
      {isOpen ? (
        <section className="admin-task-dock__panel">
          <div className="admin-task-dock__header">
            <strong>{t("task.panelTitle")}</strong>
            <button aria-label={t("task.closePanel")} onClick={() => setIsOpen(false)} type="button">x</button>
          </div>
          <div className="admin-task-dock__list">
            {taskRows.map((row) => {
              const progress = readDisplayProgress(row.status, row.progressPercent);
              const title = row.isSegment
                ? t("task.segmentTitle")
                    .replace("{index}", String(row.index))
                    .replace("{total}", String(row.total))
                : `${t(`task.kind.${row.jobKind}`)} #${row.jobId}`;
              const detail = row.isSegment
                ? t("task.segmentParent").replace("{id}", String(row.jobId))
                : t("task.units")
                    .replace("{completed}", String(row.completed))
                    .replace("{total}", String(row.total));

              return (
                <article className="admin-task-dock__item" key={row.id}>
                  <div className="admin-task-dock__item-header">
                    <span>{title}</span>
                    <small>{t(`task.status.${row.status}`)}</small>
                  </div>
                  <div
                    aria-label={t("task.progressLabel").replace("{progress}", String(progress))}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={progress}
                    className="admin-task-dock__progress"
                    role="progressbar"
                  >
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <small>{detail}</small>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? t("task.closePanel") : t("task.openPanel")}
        className="admin-task-dock__button"
        onClick={() => setIsOpen((current) => !current)}
        title={taskSummary}
        type="button"
      >
        <span aria-hidden="true" className="admin-task-dock__pulse" />
        <strong aria-hidden="true">{activeCount}</strong>
      </button>
    </aside>
  );
}
