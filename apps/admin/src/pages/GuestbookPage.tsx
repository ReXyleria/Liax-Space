import { useEffect, useState, type ReactElement } from "react";

import type { ArticleLocale } from "../api/articleApi";
import { guestbookApi, type GuestbookEntry, type GuestbookStatusFilter } from "../api/guestbookApi";
import { AdminLoadingSkeleton } from "../components/AdminLoadingSkeleton";
import { useT } from "../i18n/useT";
import { AdminLayout } from "../layout/AdminLayout";

const localeFilters: Array<ArticleLocale | "all"> = ["all", "zh-CN", "en-US"];
const statusFilters: GuestbookStatusFilter[] = ["all", "public", "private", "hidden"];

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function entryStatus(entry: GuestbookEntry): "public" | "private" | "hidden" {
  if (entry.notifyOnly) {
    return "private";
  }

  return entry.isPublic ? "public" : "hidden";
}

function replaceEntry(entries: GuestbookEntry[], entry: GuestbookEntry): GuestbookEntry[] {
  return entries.map((item) => item.id === entry.id ? entry : item);
}

export function GuestbookPage(): ReactElement {
  const t = useT();
  const [locale, setLocale] = useState<ArticleLocale | "all">("all");
  const [status, setStatus] = useState<GuestbookStatusFilter>("all");
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadEntries(): Promise<void> {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await guestbookApi.listEntries({ limit: 100, locale, status });
      setEntries(response.entries);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("guestbook.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadEntries();
  }, [locale, status]);

  async function publishEntry(entry: GuestbookEntry): Promise<void> {
    setIsWorking(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await guestbookApi.publishEntry(entry.id);
      setEntries((currentEntries) => replaceEntry(currentEntries, response.entry));
      setMessage(t("guestbook.published"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("guestbook.publishFailed"));
    } finally {
      setIsWorking(false);
    }
  }

  async function hideEntry(entry: GuestbookEntry): Promise<void> {
    setIsWorking(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await guestbookApi.hideEntry(entry.id);
      setEntries((currentEntries) => replaceEntry(currentEntries, response.entry));
      setMessage(t("guestbook.hidden"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("guestbook.hideFailed"));
    } finally {
      setIsWorking(false);
    }
  }

  async function deleteEntry(entry: GuestbookEntry): Promise<void> {
    if (!window.confirm(t("guestbook.deleteConfirm"))) {
      return;
    }

    setIsWorking(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await guestbookApi.deleteEntry(entry.id);
      setEntries((currentEntries) => currentEntries.filter((item) => item.id !== entry.id));
      setMessage(t("guestbook.deleted"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("guestbook.deleteFailed"));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <AdminLayout>
      <section className="admin-page-header">
        <div>
          <p className="admin-kicker">{t("guestbook.kicker")}</p>
          <h2>{t("guestbook.title")}</h2>
        </div>
      </section>

      <section className="liax-card admin-guestbook-toolbar">
        <label className="admin-form-field">
          <span>{t("guestbook.locale")}</span>
          <select onChange={(event) => setLocale(event.target.value as ArticleLocale | "all")} value={locale}>
            {localeFilters.map((option) => (
              <option key={option} value={option}>
                {option === "all" ? t("guestbook.allLocales") : t(option === "zh-CN" ? "locale.zhCN" : "locale.enUS")}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-form-field">
          <span>{t("guestbook.status")}</span>
          <select onChange={(event) => setStatus(event.target.value as GuestbookStatusFilter)} value={status}>
            {statusFilters.map((option) => (
              <option key={option} value={option}>{t(`guestbook.status.${option}` as never)}</option>
            ))}
          </select>
        </label>
      </section>

      {message ? <p className="admin-success-text">{message}</p> : null}
      {errorMessage ? <p className="admin-error-text">{errorMessage}</p> : null}

      <section className="admin-guestbook-list">
        {isLoading ? (
          <AdminLoadingSkeleton label={t("guestbook.loading")} rows={3} variant="list" />
        ) : entries.length === 0 ? (
          <p className="liax-card admin-empty-card">{t("guestbook.empty")}</p>
        ) : entries.map((entry) => {
          const statusName = entryStatus(entry);

          return (
            <article className="liax-card admin-guestbook-card" key={entry.id}>
              <div className="admin-guestbook-card__header">
                <div>
                  <strong>{entry.authorName}</strong>
                  <p>
                    {entry.email ?? t("guestbook.noEmail")} · {t(entry.locale === "zh-CN" ? "locale.zhCN" : "locale.enUS")} · {formatDate(entry.createdAt)}
                  </p>
                </div>
                <span className={`admin-status-badge admin-status-badge--${statusName}`}>
                  {t(`guestbook.status.${statusName}` as never)}
                </span>
              </div>
              <p className="admin-guestbook-card__content">{entry.content}</p>
              <div className="admin-form-actions">
                {statusName !== "public" ? (
                  <button className="liax-button liax-button--primary" disabled={isWorking} onClick={() => void publishEntry(entry)} type="button">
                    {t("guestbook.publish")}
                  </button>
                ) : (
                  <button className="liax-button" disabled={isWorking} onClick={() => void hideEntry(entry)} type="button">
                    {t("guestbook.hide")}
                  </button>
                )}
                <button className="liax-button" disabled={isWorking} onClick={() => void deleteEntry(entry)} type="button">
                  {t("guestbook.delete")}
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </AdminLayout>
  );
}
