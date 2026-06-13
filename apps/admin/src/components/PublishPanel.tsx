import type { ReactElement } from "react";

import type { AdminRoleDefinition } from "../api/roleApi";
import { useT } from "../i18n/useT";

export type PublishPanelProps = {
  allowedRoles: string[];
  currentVersionId: number | null;
  onAllowedRolesChange: (allowedRoles: string[]) => void;
  publishedVersionId: number | null;
  isPublishing: boolean;
  onPublish: () => void;
  roleOptions: AdminRoleDefinition[];
};

function formatVersionId(versionId: number | null, emptyText: string): string {
  return versionId === null ? emptyText : String(versionId);
}

export function PublishPanel({
  allowedRoles,
  currentVersionId,
  onAllowedRolesChange,
  publishedVersionId,
  isPublishing,
  onPublish,
  roleOptions
}: PublishPanelProps): ReactElement {
  const t = useT();
  const canPublish = currentVersionId !== null && !isPublishing;

  function roleDisplayName(role: AdminRoleDefinition): string {
    if (!role.builtIn) {
      return role.displayName;
    }

    const localizedName = t(`users.role.${role.roleKey}`);
    return localizedName.startsWith("[missing:") ? role.displayName : localizedName;
  }

  function toggleAllowedRole(roleKey: string): void {
    onAllowedRolesChange(
      allowedRoles.includes(roleKey)
        ? allowedRoles.filter((item) => item !== roleKey)
        : [...allowedRoles, roleKey]
    );
  }

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

        <fieldset className="admin-publish-visibility">
          <legend>{t("article.visibilityTitle")}</legend>
          <p className="admin-muted-text">{t("article.visibilityHelp")}</p>
          <div className="admin-role-checkbox-grid">
            {roleOptions.map((role) => (
              <label className="admin-role-checkbox" key={role.roleKey}>
                <input
                  checked={allowedRoles.includes(role.roleKey)}
                  disabled={isPublishing}
                  onChange={() => toggleAllowedRole(role.roleKey)}
                  type="checkbox"
                />
                <span>
                  <strong>{roleDisplayName(role)}</strong>
                  <code>{role.roleKey}</code>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

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
