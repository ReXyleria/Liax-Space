import { useEffect, useState, type ReactElement } from "react";

import { categoryApi, type CategoryDetail } from "../api/categoryApi";
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

function readName(category: CategoryDetail, locale: "zh-CN" | "en-US"): string {
  return category.translations.find((translation) => translation.locale === locale)?.name ?? "-";
}

function readSlug(category: CategoryDetail, locale: "zh-CN" | "en-US"): string {
  return category.translations.find((translation) => translation.locale === locale)?.slug ?? "-";
}

export function CategorySelector(): ReactElement {
  const t = useT();
  const [categories, setCategories] = useState<CategoryDetail[]>([]);
  const [form, setForm] = useState<TranslationForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCategories(): Promise<void> {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await categoryApi.listCategories();

        if (isMounted) {
          setCategories(response.categories);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : t("category.loadFailed"));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCategories();

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

  async function handleCreate(): Promise<void> {
    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await categoryApi.createCategory({
        translations: [
          { locale: "zh-CN", name: form.zhName.trim(), slug: form.zhSlug.trim() },
          { locale: "en-US", name: form.enName.trim(), slug: form.enSlug.trim() }
        ]
      });

      setCategories((currentCategories) => [response.category, ...currentCategories]);
      setForm(emptyForm);
      setMessage(t("category.created"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("category.createFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="liax-card admin-taxonomy-card">
      <div className="liax-card__header">
        <div>
          <p className="admin-kicker">{t("category.kicker")}</p>
          <h3>{t("category.title")}</h3>
        </div>
      </div>
      <div className="liax-card__body">
        <div className="admin-taxonomy-form">
          <label className="admin-form-field">
            <span>{t("category.zhName")}</span>
            <input value={form.zhName} onChange={(event) => updateForm("zhName", event.target.value)} />
          </label>
          <label className="admin-form-field">
            <span>{t("category.zhSlug")}</span>
            <input value={form.zhSlug} onChange={(event) => updateForm("zhSlug", event.target.value)} />
          </label>
          <label className="admin-form-field">
            <span>{t("category.enName")}</span>
            <input value={form.enName} onChange={(event) => updateForm("enName", event.target.value)} />
          </label>
          <label className="admin-form-field">
            <span>{t("category.enSlug")}</span>
            <input value={form.enSlug} onChange={(event) => updateForm("enSlug", event.target.value)} />
          </label>
        </div>

        <div className="admin-form-actions">
          <button className="liax-button liax-button--primary" disabled={isSaving} onClick={() => void handleCreate()} type="button">
            {isSaving ? t("category.saving") : t("category.create")}
          </button>
        </div>

        {isLoading ? <p className="admin-muted-text">{t("category.loading")}</p> : null}
        {!isLoading && categories.length === 0 ? <p className="admin-muted-text">{t("category.empty")}</p> : null}

        {categories.length > 0 ? (
          <div className="admin-taxonomy-list">
            {categories.map((category) => (
              <section className="admin-taxonomy-item" key={category.category.id}>
                <strong>#{category.category.id}</strong>
                <span>{t("locale.zhCN")}: {readName(category, "zh-CN")} / {readSlug(category, "zh-CN")}</span>
                <span>{t("locale.enUS")}: {readName(category, "en-US")} / {readSlug(category, "en-US")}</span>
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
