import type { ReactElement } from "react";

import { AdminLayout } from "../layout/AdminLayout";
import { useT } from "../i18n/useT";

export function DashboardPage(): ReactElement {
  const t = useT();

  return (
    <AdminLayout>
      <section className="admin-dashboard-grid" aria-label={t("dashboard.title")}>
        <article className="liax-card admin-card">
          <div className="liax-card__header">
            <h2>{t("dashboard.contentTitle")}</h2>
          </div>
          <div className="liax-card__body">
            <p>{t("dashboard.contentSummary")}</p>
            <button className="liax-button liax-button--primary" type="button">
              {t("article.create")}
            </button>
          </div>
        </article>

        <article className="liax-card liax-card--muted admin-card">
          <div className="liax-card__header">
            <h2>{t("dashboard.publishTitle")}</h2>
          </div>
          <div className="liax-card__body">
            <p>{t("dashboard.publishSummary")}</p>
            <button className="liax-button liax-button--brand" type="button">
              {t("article.publish")}
            </button>
          </div>
        </article>
      </section>

      <section className="admin-help-panel">
        <span>{t("dashboard.helpText")}</span>
        <a className="liax-link liax-link--accent" href="#docs">
          {t("dashboard.helpLink")}
        </a>
      </section>
    </AdminLayout>
  );
}
