import { useEffect, useMemo, useState, type ReactElement } from "react";

import { translationApi, type TranslationJob } from "../api/translationApi";
import { useT } from "../i18n/useT";

export type TaskProgressDockProps = {
  enabled: boolean;
};

const taskPollIntervalMs = 2_500;

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function readDisplayProgress(job: TranslationJob): number {
  if (job.status === "queued") {
    return Math.max(3, clampProgress(job.progressPercent));
  }

  if (job.status === "running") {
    return Math.max(8, clampProgress(job.progressPercent));
  }

  return clampProgress(job.progressPercent);
}

export function TaskProgressDock({ enabled }: TaskProgressDockProps): ReactElement | null {
  const t = useT();
  const [jobs, setJobs] = useState<TranslationJob[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const activeCount = jobs.length;
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
            {jobs.map((job) => {
              const progress = readDisplayProgress(job);

              return (
                <article className="admin-task-dock__item" key={job.id}>
                  <div className="admin-task-dock__item-header">
                    <span>{t(`task.kind.${job.kind}`)} #{job.id}</span>
                    <small>{t(`task.status.${job.status}`)}</small>
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
                  <small>
                    {t("task.units")
                      .replace("{completed}", String(job.progressCompleted))
                      .replace("{total}", String(job.progressTotal))}
                  </small>
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
