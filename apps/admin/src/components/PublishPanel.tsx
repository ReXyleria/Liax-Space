import type { ReactElement } from "react";

import { useT } from "../i18n/useT";

export type PublishPanelProps = {
  currentVersionId: number | null;
  publishedVersionId: number | null;
  isPublishing: boolean;
  onPublish: () => void;
};

function formatVersionId(versionId: number | null, emptyText: string): string {
  return versionId === null ? emptyText : String(versionId);
}

export function PublishPanel({
  currentVersionId,
  publishedVersionId,
  isPublishing,
  onPublish
}: PublishPanelProps): ReactElement {
  const t = useT();
  const canPublish = currentVersionId !== null && !isPublishing;

  return (
    <article className="liax-card admin-publish-panel">
      <div className="liax-card__header">
        <div>
          <p className="admin-kicker">{t("article.publishKicker")}</p>
          <h3>{t("article.publishPanelTitle")}</h3>
        </div>
      </div>
      <div className="liax-card__body">
        <dl className="admin-version-summary">
          <div>
            <dt>{t("article.currentVersionId")}</dt>
            <dd>{formatVersionId(currentVersionId, t("article.noVersion"))}</dd>
          </div>
          <div>
            <dt>{t("article.publishedVersionId")}</dt>
            <dd>{formatVersionId(publishedVersionId, t("article.noVersion"))}</dd>
          </div>
        </dl>

        <button
          className="liax-button liax-button--primary"
          disabled={!canPublish}
          onClick={onPublish}
          type="button"
        >
          {isPublishing ? t("article.publishing") : t("article.publishCurrent")}
        </button>

        {currentVersionId === null ? <p className="admin-muted-text">{t("article.noCurrentVersion")}</p> : null}
      </div>
    </article>
  );
}
