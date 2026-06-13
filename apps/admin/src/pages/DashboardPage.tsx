import { useEffect, useMemo, useState, type ReactElement } from "react";

import { dashboardApi, type DashboardMetric, type DashboardRange, type DashboardSummary } from "../api/dashboardApi";
import { AdminLayout } from "../layout/AdminLayout";
import { useT } from "../i18n/useT";

const ranges: DashboardRange[] = [7, 14, 30];

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function maxVisits(items: DashboardMetric[]): number {
  return Math.max(1, ...items.map((item) => item.visits));
}

function MetricBars({ items, labelFor }: {
  items: DashboardMetric[];
  labelFor: (item: DashboardMetric) => string;
}): ReactElement {
  const max = maxVisits(items);

  if (items.length === 0) {
    return <p className="admin-muted-text">-</p>;
  }

  return (
    <div className="admin-dashboard-bars">
      {items.map((item) => (
        <div className="admin-dashboard-bar" key={`${labelFor(item)}-${item.visits}`}>
          <div className="admin-dashboard-bar__meta">
            <span>{labelFor(item)}</span>
            <strong>{formatNumber(item.visits)}</strong>
          </div>
          <div className="admin-dashboard-bar__track">
            <span style={{ width: `${Math.max(4, (item.visits / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage(): ReactElement {
  const t = useT();
  const [range, setRange] = useState<DashboardRange>(7);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const statCards = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return [
      { key: "dashboard.stat.articles", value: dashboard.totals.articles },
      { key: "dashboard.stat.users", value: dashboard.totals.users },
      { key: "dashboard.stat.comments", value: dashboard.totals.comments },
      { key: "dashboard.stat.guestbook", value: dashboard.totals.guestbook },
      { key: "dashboard.stat.todayVisits", value: dashboard.totals.todayVisits },
      { key: "dashboard.stat.rangeVisits", value: dashboard.totals.visits }
    ];
  }, [dashboard]);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setErrorMessage(null);

    dashboardApi.getDashboard(range)
      .then((response) => {
        if (isMounted) {
          setDashboard(response.dashboard);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : t("dashboard.loadFailed"));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [range, t]);

  return (
    <AdminLayout>
      <section className="admin-page-header">
        <div>
          <p className="admin-kicker">{t("dashboard.kicker")}</p>
          <h2>{t("dashboard.title")}</h2>
        </div>
        <div className="admin-dashboard-range" aria-label={t("dashboard.range")}>
          {ranges.map((rangeOption) => (
            <button
              className={range === rangeOption ? "liax-button liax-button--primary" : "liax-button"}
              key={rangeOption}
              onClick={() => setRange(rangeOption)}
              type="button"
            >
              {t(`dashboard.range.${rangeOption}` as never)}
            </button>
          ))}
        </div>
      </section>

      {isLoading ? <p className="admin-muted-text">{t("dashboard.loading")}</p> : null}
      {errorMessage ? <p className="admin-error-text">{errorMessage}</p> : null}

      {dashboard ? (
        <>
          <section className="admin-dashboard-stats" aria-label={t("dashboard.overview")}>
            {statCards.map((card) => (
              <article className="liax-card admin-dashboard-stat" key={card.key}>
                <p>{t(card.key as never)}</p>
                <strong>{formatNumber(card.value)}</strong>
              </article>
            ))}
          </section>

          <section className="admin-dashboard-grid" aria-label={t("dashboard.analytics")}>
            <article className="liax-card admin-dashboard-panel">
              <div className="liax-card__header">
                <h3>{t("dashboard.dailyVisits")}</h3>
              </div>
              <div className="liax-card__body">
                <MetricBars items={dashboard.dailyVisits} labelFor={(item) => item.date ?? "-"} />
              </div>
            </article>

            <article className="liax-card admin-dashboard-panel">
              <div className="liax-card__header">
                <h3>{t("dashboard.countryVisits")}</h3>
              </div>
              <div className="liax-card__body">
                <MetricBars items={dashboard.countryVisits} labelFor={(item) => item.label ?? "-"} />
              </div>
            </article>

            <article className="liax-card admin-dashboard-panel">
              <div className="liax-card__header">
                <h3>{t("dashboard.visitDevices")}</h3>
              </div>
              <div className="liax-card__body">
                <MetricBars items={dashboard.visitDevices} labelFor={(item) => t(`dashboard.device.${item.label ?? "unknown"}` as never)} />
              </div>
            </article>

            <article className="liax-card admin-dashboard-panel">
              <div className="liax-card__header">
                <h3>{t("dashboard.loginDevices")}</h3>
              </div>
              <div className="liax-card__body">
                <MetricBars items={dashboard.loginDevices} labelFor={(item) => t(`dashboard.device.${item.label ?? "unknown"}` as never)} />
              </div>
            </article>
          </section>

          <section className="admin-dashboard-lists">
            <article className="liax-card admin-dashboard-list">
              <div className="liax-card__header">
                <h3>{t("dashboard.recentPublished")}</h3>
              </div>
              <div className="liax-card__body">
                {dashboard.recentPublished.length === 0 ? (
                  <p className="admin-muted-text">{t("dashboard.recentEmpty")}</p>
                ) : dashboard.recentPublished.map((article) => (
                  <a className="admin-dashboard-list__item" href={`#articles/${article.articleId}/edit`} key={`${article.articleId}-${article.locale}`}>
                    <span>{article.title}</span>
                    <small>{article.locale} · {formatDate(article.publishedAt)}</small>
                  </a>
                ))}
              </div>
            </article>

            <article className="liax-card admin-dashboard-list">
              <div className="liax-card__header">
                <h3>{t("dashboard.popularPages")}</h3>
              </div>
              <div className="liax-card__body">
                {dashboard.popularPages.length === 0 ? (
                  <p className="admin-muted-text">{t("dashboard.popularEmpty")}</p>
                ) : dashboard.popularPages.map((page) => (
                  <a className="admin-dashboard-list__item" href={page.path ?? "#dashboard"} key={`${page.path}-${page.visits}`}>
                    <span>{page.path}</span>
                    <small>{formatNumber(page.visits)} {t("dashboard.visits")}</small>
                  </a>
                ))}
              </div>
            </article>
          </section>
        </>
      ) : null}
    </AdminLayout>
  );
}
