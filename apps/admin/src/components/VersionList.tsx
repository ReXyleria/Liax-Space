import type { ReactElement } from "react";

import type { ArticleVersion } from "../api/versionApi";
import { useT } from "../i18n/useT";

export type VersionListProps = {
  versions: ArticleVersion[];
  selectedVersionId: number | null;
  isBusy: boolean;
  onRollback: (version: ArticleVersion) => void;
  onSelect: (version: ArticleVersion) => void;
  onTogglePin: (version: ArticleVersion) => void;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatBytes(value: number): string {
  if (value >= 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }

  if (value >= 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${value} B`;
}

export function VersionList({
  versions,
  selectedVersionId,
  isBusy,
  onRollback,
  onSelect,
  onTogglePin
}: VersionListProps): ReactElement {
  const t = useT();

  if (versions.length === 0) {
    return (
      <article className="liax-card">
        <div className="liax-card__body">
          <p className="admin-muted-text">{t("article.noVersions")}</p>
        </div>
      </article>
    );
  }

  return (
    <article className="liax-card admin-version-list">
      <div className="liax-card__header">
        <h3>{t("article.versionListTitle")}</h3>
      </div>
      <div className="liax-card__body admin-version-list__body">
        {versions.map((version) => (
          <section
            className="admin-version-item"
            data-selected={selectedVersionId === version.id ? "true" : "false"}
            key={version.id}
          >
            <div className="admin-version-item__main">
              <div>
                <h4>
                  {t("article.versionNo")} {version.versionNo}
                </h4>
                <p>
                  {t("article.versionId")}: {version.id}
                </p>
              </div>
              <span className="admin-status-badge" data-status={version.renderStatus}>
                {version.renderStatus}
              </span>
            </div>

            <dl className="admin-version-meta">
              <div>
                <dt>{t("article.createdAt")}</dt>
                <dd>{formatDate(version.createdAt)}</dd>
              </div>
              <div>
                <dt>{t("article.pinned")}</dt>
                <dd>{version.isPinned ? t("article.yes") : t("article.no")}</dd>
              </div>
              {version.contentSizeBytes !== undefined ? (
                <div>
                  <dt>{t("article.versionSize")}</dt>
                  <dd>{formatBytes(version.contentSizeBytes)}</dd>
                </div>
              ) : null}
            </dl>

            <div className="admin-version-actions">
              <button
                className="liax-button"
                disabled={isBusy}
                onClick={() => onSelect(version)}
                type="button"
              >
                {t("article.viewMarkdown")}
              </button>
              <button
                className="liax-button"
                disabled={isBusy}
                onClick={() => onRollback(version)}
                type="button"
              >
                {t("article.rollback")}
              </button>
              <button
                className="liax-button"
                disabled={isBusy}
                onClick={() => onTogglePin(version)}
                type="button"
              >
                {version.isPinned ? t("article.unpin") : t("article.pin")}
              </button>
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
