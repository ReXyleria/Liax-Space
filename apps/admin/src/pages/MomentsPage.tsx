import { useEffect, useMemo, useState, type ClipboardEvent, type FormEvent, type ReactElement, type SyntheticEvent } from "react";

import { attachmentApi } from "../api/attachmentApi";
import type { ArticleLocale } from "../api/articleApi";
import { momentApi, type Moment, type MomentStatus } from "../api/momentApi";
import { useT } from "../i18n/useT";
import { AdminLayout } from "../layout/AdminLayout";

const locales: ArticleLocale[] = ["zh-CN", "en-US"];
const maxMomentLength = 500;

type MomentForm = {
  locale: ArticleLocale;
  content: string;
  imagesText: string;
  status: MomentStatus;
};

type MomentDraft = {
  content: string;
  imagesText: string;
};

const initialForm: MomentForm = {
  content: "",
  imagesText: "",
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

function parseImageUrls(value: string): string[] {
  return value.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean);
}

export function MomentsPage(): ReactElement {
  const t = useT();
  const [form, setForm] = useState<MomentForm>(initialForm);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [isPastingImage, setIsPastingImage] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [momentDrafts, setMomentDrafts] = useState<Record<number, MomentDraft>>({});
  const remainingCharacters = useMemo(() => maxMomentLength - form.content.length, [form.content]);

  async function loadMoments(): Promise<void> {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await momentApi.listMoments();
      setMoments(sortMoments(response.moments));
      setMomentDrafts(Object.fromEntries(response.moments.map((moment) => [
        moment.id,
        {
          content: moment.content,
          imagesText: moment.images.join("\n")
        }
      ])));
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
      const response = await momentApi.createMoment({
        content: form.content,
        images: parseImageUrls(form.imagesText),
        locale: form.locale,
        status: form.status
      });
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
      setMomentDrafts((currentDrafts) => {
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

  function draftFor(moment: Moment): MomentDraft {
    return momentDrafts[moment.id] ?? {
      content: moment.content,
      imagesText: moment.images.join("\n")
    };
  }

  function updateMomentDraft(momentId: number, patch: Partial<MomentDraft>): void {
    setMomentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [momentId]: {
        content: currentDrafts[momentId]?.content ?? moments.find((moment) => moment.id === momentId)?.content ?? "",
        imagesText: currentDrafts[momentId]?.imagesText ?? moments.find((moment) => moment.id === momentId)?.images.join("\n") ?? "",
        ...patch
      }
    }));
  }

  async function saveMomentContent(moment: Moment): Promise<void> {
    const draft = draftFor(moment);

    if (!draft.content.trim()) {
      setErrorMessage(t("moment.contentRequired"));
      setMessage(null);
      return;
    }

    if (draft.content.length > maxMomentLength) {
      setErrorMessage(t("moment.tooLong"));
      setMessage(null);
      return;
    }

    setIsWorking(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await momentApi.updateMoment(moment.id, {
        content: draft.content,
        images: parseImageUrls(draft.imagesText)
      });
      setMoments((currentMoments) => replaceMoment(currentMoments, response.moment));
      setMomentDrafts((currentDrafts) => ({
        ...currentDrafts,
        [moment.id]: {
          content: response.moment.content,
          imagesText: response.moment.images.join("\n")
        }
      }));
      setMessage(t("moment.contentSaved"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("moment.contentSaveFailed"));
    } finally {
      setIsWorking(false);
    }
  }

  async function handlePasteImages(
    event: ClipboardEvent<HTMLTextAreaElement>,
    target: "composer" | { momentId: number }
  ): Promise<void> {
    const imageFiles = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length === 0) {
      return;
    }

    event.preventDefault();
    setIsPastingImage(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const urls: string[] = [];

      for (const file of imageFiles) {
        const result = await attachmentApi.uploadAttachment(file);

        if (result.attachment.publicUrl) {
          urls.push(result.attachment.publicUrl);
        }
      }

      if (urls.length === 0) {
        throw new Error(t("attachment.uploadFailed"));
      }

      const appendUrls = (currentValue: string): string => {
        const prefix = currentValue.trim() ? `${currentValue.trim()}\n` : "";
        return `${prefix}${urls.join("\n")}`;
      };

      if (target === "composer") {
        setForm((currentForm) => ({
          ...currentForm,
          imagesText: appendUrls(currentForm.imagesText)
        }));
      } else {
        const targetMoment = moments.find((moment) => moment.id === target.momentId);

        if (!targetMoment) {
          return;
        }

        updateMomentDraft(target.momentId, {
          imagesText: appendUrls(draftFor(targetMoment).imagesText)
        });
      }

      setMessage(t("attachment.pasted"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("attachment.uploadFailed"));
    } finally {
      setIsPastingImage(false);
    }
  }

  function handleImageError(event: SyntheticEvent<HTMLImageElement>): void {
    event.currentTarget.remove();
  }

  function momentCharactersLeft(moment: Moment): number {
    return maxMomentLength - draftFor(moment).content.length;
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
              onPaste={(event) => void handlePasteImages(event, "composer")}
              value={form.content}
            />
          </label>
          <label className="admin-form-field">
            <span>{t("moment.images")}</span>
            <textarea
              className="admin-moment-image-field"
              disabled={isWorking}
              onChange={(event) => setForm((currentForm) => ({ ...currentForm, imagesText: event.target.value }))}
              onPaste={(event) => void handlePasteImages(event, "composer")}
              placeholder={t("moment.imagesPlaceholder")}
              value={form.imagesText}
            />
          </label>
          <div className="admin-moment-footer">
            <span className={remainingCharacters < 0 ? "admin-error-text" : "admin-muted-text"}>
              {t("moment.charactersLeft")}: {remainingCharacters}
            </span>
            <button className="liax-button liax-button--brand" disabled={isWorking} type="submit">
              {isWorking ? t("moment.saving") : t("moment.create")}
            </button>
            {isPastingImage ? <span className="admin-muted-text">{t("attachment.uploading")}</span> : null}
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
              <label className="admin-form-field">
                <span>{t("moment.content")}</span>
                <textarea
                  className="admin-moment-textarea"
                  disabled={isWorking}
                  maxLength={maxMomentLength}
                  onChange={(event) => updateMomentDraft(moment.id, { content: event.target.value })}
                  onPaste={(event) => void handlePasteImages(event, { momentId: moment.id })}
                  value={draftFor(moment).content}
                />
              </label>
              <label className="admin-form-field">
                <span>{t("moment.images")}</span>
                <textarea
                  className="admin-moment-image-field"
                  disabled={isWorking}
                  onChange={(event) => updateMomentDraft(moment.id, { imagesText: event.target.value })}
                  onPaste={(event) => void handlePasteImages(event, { momentId: moment.id })}
                  placeholder={t("moment.imagesPlaceholder")}
                  value={draftFor(moment).imagesText}
                />
              </label>
              <span className={momentCharactersLeft(moment) < 0 ? "admin-error-text" : "admin-muted-text"}>
                {t("moment.charactersLeft")}: {momentCharactersLeft(moment)}
              </span>
              {parseImageUrls(draftFor(moment).imagesText).length > 0 ? (
                <div className="admin-moment-images">
                  {parseImageUrls(draftFor(moment).imagesText).map((image) => (
                    <img alt="" key={image} loading="lazy" onError={handleImageError} src={image} />
                  ))}
                </div>
              ) : null}
              <div className="admin-form-actions">
                <button className="liax-button liax-button--primary" disabled={isWorking || isPastingImage} onClick={() => void saveMomentContent(moment)} type="button">
                  {isWorking ? t("moment.saving") : t("moment.saveContent")}
                </button>
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
