import { useEffect, useMemo, useState, type ReactElement } from "react";

import { tagApi, type TagDetail } from "../api/tagApi";
import { useT } from "../i18n/useT";

type TranslationForm = {
  enName: string;
  enSlug: string;
  zhName: string;
  zhSlug: string;
};

const emptyForm: TranslationForm = {
  enName: "",
  enSlug: "",
  zhName: "",
  zhSlug: ""
};

function readName(tag: TagDetail, locale: "zh-CN" | "en-US"): string {
  return tag.translations.find((translation) => translation.locale === locale)?.name ?? "-";
}

function readSlug(tag: TagDetail, locale: "zh-CN" | "en-US"): string {
  return tag.translations.find((translation) => translation.locale === locale)?.slug ?? "-";
}

function formFromTag(tag: TagDetail): TranslationForm {
  return {
    enName: readName(tag, "en-US") === "-" ? "" : readName(tag, "en-US"),
    enSlug: readSlug(tag, "en-US") === "-" ? "" : readSlug(tag, "en-US"),
    zhName: readName(tag, "zh-CN") === "-" ? "" : readName(tag, "zh-CN"),
    zhSlug: readSlug(tag, "zh-CN") === "-" ? "" : readSlug(tag, "zh-CN")
  };
}

function isCompleteForm(form: TranslationForm): boolean {
  return Boolean(form.zhName.trim() && form.zhSlug.trim() && form.enName.trim() && form.enSlug.trim());
}

export function TagSelector(): ReactElement {
  const t = useT();
  const [tags, setTags] = useState<TagDetail[]>([]);
  const [form, setForm] = useState<TranslationForm>(emptyForm);
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<TranslationForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMutatingTagId, setIsMutatingTagId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canCreate = useMemo(() => isCompleteForm(form), [form]);

  useEffect(() => {
    let isMounted = true;

    async function loadTags(): Promise<void> {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await tagApi.listTags();

        if (isMounted) {
          setTags(response.tags);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : t("tag.loadFailed"));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadTags();

    return () => {
      isMounted = false;
    };
  }, [t]);

  function updateForm(field: keyof TranslationForm, value: string): void {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  function updateEditForm(field: keyof TranslationForm, value: string): void {
    setEditForm((currentForm) => ({
      ...currentForm,
      [field]: value
    }));
  }

  async function handleCreate(): Promise<void> {
    if (!canCreate) {
      setErrorMessage(t("tag.required"));
      return;
    }

    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await tagApi.createTag([
        { locale: "zh-CN", name: form.zhName.trim(), slug: form.zhSlug.trim() },
        { locale: "en-US", name: form.enName.trim(), slug: form.enSlug.trim() }
      ]);

      setTags((currentTags) => [response.tag, ...currentTags]);
      setForm(emptyForm);
      setMessage(t("tag.created"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("tag.createFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  function startEditing(tag: TagDetail): void {
    setEditingTagId(tag.tag.id);
    setEditForm(formFromTag(tag));
    setMessage(null);
    setErrorMessage(null);
  }

  async function handleSaveTag(tagId: number): Promise<void> {
    if (!isCompleteForm(editForm)) {
      setErrorMessage(t("tag.required"));
      return;
    }

    setIsMutatingTagId(tagId);
    setMessage(null);
    setErrorMessage(null);

    try {
      await tagApi.updateTranslation(tagId, "zh-CN", {
        name: editForm.zhName.trim(),
        slug: editForm.zhSlug.trim()
      });
      const response = await tagApi.updateTranslation(tagId, "en-US", {
        name: editForm.enName.trim(),
        slug: editForm.enSlug.trim()
      });

      setTags((currentTags) => currentTags.map((tag) => tag.tag.id === tagId ? response.tag : tag));
      setEditingTagId(null);
      setEditForm(emptyForm);
      setMessage(t("tag.updated"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("tag.saveFailed"));
    } finally {
      setIsMutatingTagId(null);
    }
  }

  async function handleDeleteTag(tagId: number): Promise<void> {
    setIsMutatingTagId(tagId);
    setMessage(null);
    setErrorMessage(null);

    try {
      await tagApi.deleteTag(tagId);
      setTags((currentTags) => currentTags.filter((tag) => tag.tag.id !== tagId));
      setMessage(t("tag.deleted"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("tag.deleteFailed"));
    } finally {
      setIsMutatingTagId(null);
    }
  }

  return (
    <article className="liax-card admin-taxonomy-card">
      <div className="liax-card__header">
        <div>
          <p className="admin-kicker">{t("tag.kicker")}</p>
          <h3>{t("tag.title")}</h3>
        </div>
      </div>
      <div className="liax-card__body">
        <div className="admin-taxonomy-summary" aria-label={t("tag.summary")}>
          <strong>{tags.length}</strong>
          <span>{t("tag.summary")}</span>
        </div>

        <div className="admin-taxonomy-form">
          <label className="admin-form-field">
            <span>{t("tag.zhName")}</span>
            <input value={form.zhName} onChange={(event) => updateForm("zhName", event.target.value)} />
          </label>
          <label className="admin-form-field">
            <span>{t("tag.zhSlug")}</span>
            <input value={form.zhSlug} onChange={(event) => updateForm("zhSlug", event.target.value)} />
          </label>
          <label className="admin-form-field">
            <span>{t("tag.enName")}</span>
            <input value={form.enName} onChange={(event) => updateForm("enName", event.target.value)} />
          </label>
          <label className="admin-form-field">
            <span>{t("tag.enSlug")}</span>
            <input value={form.enSlug} onChange={(event) => updateForm("enSlug", event.target.value)} />
          </label>
        </div>

        <div className="admin-form-actions">
          <button className="liax-button liax-button--primary" disabled={isSaving || !canCreate} onClick={() => void handleCreate()} type="button">
            {isSaving ? t("tag.saving") : t("tag.create")}
          </button>
        </div>

        {isLoading ? <p className="admin-muted-text">{t("tag.loading")}</p> : null}
        {!isLoading && tags.length === 0 ? <p className="admin-muted-text">{t("tag.empty")}</p> : null}

        {tags.length > 0 ? (
          <div className="admin-taxonomy-list">
            {tags.map((tag) => (
              <section className="admin-taxonomy-item" key={tag.tag.id}>
                <div className="admin-taxonomy-item__header">
                  <strong>#{tag.tag.id}</strong>
                  <time dateTime={tag.tag.createdAt}>{new Date(tag.tag.createdAt).toLocaleDateString()}</time>
                </div>

                {editingTagId === tag.tag.id ? (
                  <div className="admin-taxonomy-edit">
                    <label className="admin-form-field">
                      <span>{t("tag.zhName")}</span>
                      <input value={editForm.zhName} onChange={(event) => updateEditForm("zhName", event.target.value)} />
                    </label>
                    <label className="admin-form-field">
                      <span>{t("tag.zhSlug")}</span>
                      <input value={editForm.zhSlug} onChange={(event) => updateEditForm("zhSlug", event.target.value)} />
                    </label>
                    <label className="admin-form-field">
                      <span>{t("tag.enName")}</span>
                      <input value={editForm.enName} onChange={(event) => updateEditForm("enName", event.target.value)} />
                    </label>
                    <label className="admin-form-field">
                      <span>{t("tag.enSlug")}</span>
                      <input value={editForm.enSlug} onChange={(event) => updateEditForm("enSlug", event.target.value)} />
                    </label>
                  </div>
                ) : (
                  <div className="admin-taxonomy-locales">
                    <div className="admin-taxonomy-locale">
                      <span>{t("locale.zhCN")}</span>
                      <strong>{readName(tag, "zh-CN")}</strong>
                      <code>{readSlug(tag, "zh-CN")}</code>
                    </div>
                    <div className="admin-taxonomy-locale">
                      <span>{t("locale.enUS")}</span>
                      <strong>{readName(tag, "en-US")}</strong>
                      <code>{readSlug(tag, "en-US")}</code>
                    </div>
                  </div>
                )}

                <div className="admin-taxonomy-actions">
                  {editingTagId === tag.tag.id ? (
                    <>
                      <button className="liax-button liax-button--primary" disabled={isMutatingTagId === tag.tag.id} onClick={() => void handleSaveTag(tag.tag.id)} type="button">
                        {isMutatingTagId === tag.tag.id ? t("tag.saving") : t("tag.save")}
                      </button>
                      <button className="liax-button" disabled={isMutatingTagId === tag.tag.id} onClick={() => setEditingTagId(null)} type="button">
                        {t("tag.cancel")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="liax-button" disabled={isMutatingTagId === tag.tag.id} onClick={() => startEditing(tag)} type="button">
                        {t("tag.edit")}
                      </button>
                      <button className="liax-button" disabled={isMutatingTagId === tag.tag.id} onClick={() => void handleDeleteTag(tag.tag.id)} type="button">
                        {t("tag.delete")}
                      </button>
                    </>
                  )}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        {message ? <p className="admin-success-text">{message}</p> : null}
        {errorMessage ? <p className="admin-error-text">{errorMessage}</p> : null}
      </div>
    </article>
  );
}
