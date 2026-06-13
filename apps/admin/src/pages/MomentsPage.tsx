import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from "react";

import type { ArticleLocale } from "../api/articleApi";
import { momentApi, type Moment, type MomentStatus } from "../api/momentApi";
import { useT } from "../i18n/useT";
import { AdminLayout } from "../layout/AdminLayout";
import { dateTimeLocalToIso, toDateTimeLocalValue } from "../utils/dateTime";

const locales: ArticleLocale[] = ["zh-CN", "en-US"];
const maxMomentLength = 500;

type MomentForm = {
  locale: ArticleLocale;
  content: string;
  status: MomentStatus;
};

const initialForm: MomentForm = {
  content: "",
  locale: "zh-CN",
  status: "draft"
};

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function sortMoments(moments: Moment[]): Moment[] {
  return [...moments].sort((left, right) => {
    const leftTime = new Date(left.publishedAt ?? left.createdAt).getTime();
    const rightTime = new Date(right.publishedAt ?? right.createdAt).getTime();
    return rightTime - leftTime;
  });
}

function replaceMoment(moments: Moment[], moment: Moment): Moment[] {
  const exists = moments.some((item) => item.id === moment.id);
  const nextMoments = exists
    ? moments.map((item) => item.id === moment.id ? moment : item)
    : [moment, ...moments];

  return sortMoments(nextMoments);
}

export function MomentsPage(): ReactElement {
  const t = useT();
  const [form, setForm] = useState<MomentForm>(initialForm);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publishedAtDrafts, setPublishedAtDrafts] = useState<Record<number, string>>({});
  const remainingCharacters = useMemo(() => maxMomentLength - form.content.length, [form.content]);

  async function loadMoments(): Promise<void> {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await momentApi.listMoments();
      setMoments(sortMoments(response.moments));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("moment.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadMoments();
  }, []);

  async function createMoment(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!form.content.trim()) {
      setErrorMessage(t("moment.contentRequired"));
      return;
    }

    if (remainingCharacters < 0) {
      setErrorMessage(t("moment.tooLong"));
      return;
    }

    setIsWorking(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await momentApi.createMoment(form);
      setMoments((currentMoments) => replaceMoment(currentMoments, response.moment));
      setForm(initialForm);
      setMessage(form.status === "published" ? t("moment.createdPublished") : t("moment.createdDraft"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("moment.createFailed"));
    } finally {
      setIsWorking(false);
    }
  }

  async function publishMoment(moment: Moment): Promise<void> {
    setIsWorking(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await momentApi.publishMoment(moment.id);
      setMoments((currentMoments) => replaceMoment(currentMoments, response.moment));
      setPublishedAtDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[moment.id];
        return nextDrafts;
      });
      setMessage(t("moment.published"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("moment.publishFailed"));
    } finally {
      setIsWorking(false);
    }
  }

  async function unpublishMoment(moment: Moment): Promise<void> {
    setIsWorking(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await momentApi.unpublishMoment(moment.id);
      setMoments((currentMoments) => replaceMoment(currentMoments, response.moment));
      setPublishedAtDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[moment.id];
        return nextDrafts;
      });
      setMessage(t("moment.unpublished"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("moment.unpublishFailed"));
    } finally {
      setIsWorking(false);
    }
  }

  async function deleteMoment(moment: Moment): Promise<void> {
    setIsWorking(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      await momentApi.deleteMoment(moment.id);
      setMoments((currentMoments) => currentMoments.filter((item) => item.id !== moment.id));
      setPublishedAtDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[moment.id];
        return nextDrafts;
      });
      setMessage(t("moment.deleted"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("moment.deleteFailed"));
    } finally {
      setIsWorking(false);
    }
  }

  function momentPublishedAtValue(moment: Moment): string {
    return publishedAtDrafts[moment.id] ?? toDateTimeLocalValue(moment.publishedAt);
  }

  async function updateMomentPublishedAt(moment: Moment): Promise<void> {
    const publishedAt = dateTimeLocalToIso(momentPublishedAtValue(moment));

    if (!publishedAt) {
      setErrorMessage(t("moment.publishedAtInvalid"));
      setMessage(null);
      return;
    }

    setIsWorking(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await momentApi.updateMoment(moment.id, { publishedAt });
      setMoments((currentMoments) => replaceMoment(currentMoments, response.moment));
      setPublishedAtDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts };
        delete nextDrafts[moment.id];
        return nextDrafts;
      });
      setMessage(t("moment.publishedAtSaved"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("moment.publishedAtSaveFailed"));
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <AdminLayout>
      <section className="admin-page-header">
        <div>
          <p className="admin-kicker">{t("moment.kicker")}</p>
          <h2>{t("moment.title")}</h2>
        </div>
      </section>

      <section className="liax-card admin-moment-composer">
        <div className="liax-card__header">
          <div>
            <p className="admin-kicker">{t("moment.composeKicker")}</p>
            <h3>{t("moment.composeTitle")}</h3>
          </div>
        </div>
        <form className="liax-card__body" onSubmit={(event) => void createMoment(event)}>
          <div className="admin-moment-controls">
            <label className="admin-form-field">
              <span>{t("moment.locale")}</span>
              <select
                disabled={isWorking}
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, locale: event.target.value as ArticleLocale }))}
                value={form.locale}
              >
                {locales.map((locale) => (
                  <option key={locale} value={locale}>{t(locale === "zh-CN" ? "locale.zhCN" : "locale.enUS")}</option>
                ))}
              </select>
            </label>
            <label className="admin-form-field">
              <span>{t("moment.initialStatus")}</span>
              <select
                disabled={isWorking}
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, status: event.target.value as MomentStatus }))}
                value={form.status}
              >
                <option value="draft">{t("moment.status.draft")}</option>
                <option value="published">{t("moment.status.published")}</option>
              </select>
            </label>
          </div>
          <label className="admin-form-field">
            <span>{t("moment.content")}</span>
            <textarea
              className="admin-moment-textarea"
              disabled={isWorking}
              maxLength={maxMomentLength}
              onChange={(event) => setForm((currentForm) => ({ ...currentForm, content: event.target.value }))}
              value={form.content}
            />
          </label>
          <div className="admin-moment-footer">
            <span className={remainingCharacters < 0 ? "admin-error-text" : "admin-muted-text"}>
              {t("moment.charactersLeft")}: {remainingCharacters}
            </span>
            <button className="liax-button liax-button--brand" disabled={isWorking} type="submit">
              {isWorking ? t("moment.saving") : t("moment.create")}
            </button>
          </div>
        </form>
      </section>

      <section className="admin-moment-list">
        {isLoading ? (
          <p className="admin-muted-text">{t("moment.loading")}</p>
        ) : moments.length === 0 ? (
          <p className="liax-card admin-empty-card">{t("moment.empty")}</p>
        ) : (
          moments.map((moment) => (
            <article className="liax-card admin-moment-card" key={moment.id}>
              <div className="admin-moment-card__meta">
                <span className="admin-status-badge">{t(moment.locale === "zh-CN" ? "locale.zhCN" : "locale.enUS")}</span>
                <span className="admin-status-badge">{t(moment.status === "published" ? "moment.status.published" : "moment.status.draft")}</span>
                <time>{formatDate(moment.publishedAt ?? moment.createdAt)}</time>
              </div>
              <p>{moment.content}</p>
              {moment.status === "published" ? (
                <div className="admin-moment-published-time">
                  <label className="admin-form-field">
                    <span>{t("moment.publishedAt")}</span>
                    <input
                      disabled={isWorking}
                      onChange={(event) => setPublishedAtDrafts((currentDrafts) => ({
                        ...currentDrafts,
                        [moment.id]: event.target.value
                      }))}
                      type="datetime-local"
                      value={momentPublishedAtValue(moment)}
                    />
                  </label>
                  <button
                    className="liax-button"
                    disabled={isWorking}
                    onClick={() => void updateMomentPublishedAt(moment)}
                    type="button"
                  >
                    {t("moment.publishedAtSave")}
                  </button>
                </div>
              ) : null}
              <div className="admin-form-actions">
                {moment.status === "published" ? (
                  <button className="liax-button" disabled={isWorking} onClick={() => void unpublishMoment(moment)} type="button">
                    {t("moment.unpublish")}
                  </button>
                ) : (
                  <button className="liax-button liax-button--primary" disabled={isWorking} onClick={() => void publishMoment(moment)} type="button">
                    {t("moment.publish")}
                  </button>
                )}
                <button className="liax-button" disabled={isWorking} onClick={() => void deleteMoment(moment)} type="button">
                  {t("moment.delete")}
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {message ? <p className="admin-success-text">{message}</p> : null}
      {errorMessage ? <p className="admin-error-text">{errorMessage}</p> : null}
    </AdminLayout>
  );
}
