import { useEffect, useMemo, useState, type ReactElement } from "react";

import {
  articleApi,
  type ArticleDetail,
  type ArticleLocale,
  type ArticleTranslation
} from "../api/articleApi";
import { translationApi } from "../api/translationApi";
import { LocaleTabs } from "../components/LocaleTabs";
import { SeoFields, type TranslationMetadataFormValue } from "../components/SeoFields";
import { AdminLayout } from "../layout/AdminLayout";
import { useT } from "../i18n/useT";
import { dateTimeLocalToIso, toDateTimeLocalValue } from "../utils/dateTime";

export type ArticleTranslationEditPageProps = {
  articleId: number;
};

type TranslationFormState = Record<ArticleLocale, TranslationMetadataFormValue>;
type ExistingTranslationState = Record<ArticleLocale, ArticleTranslation | null>;

function createUuidSlug(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
    const randomValue = Math.floor(Math.random() * 16);
    const value = token === "x" ? randomValue : (randomValue & 0x3) | 0x8;
    return value.toString(16);
  });
}

function createEmptyFormValue(): TranslationMetadataFormValue {
  return {
    publishedAt: "",
    seoDescription: "",
    seoTitle: "",
    slug: createUuidSlug(),
    summary: "",
    title: ""
  };
}

function emptyFormState(): TranslationFormState {
  return {
    "en-US": createEmptyFormValue(),
    "zh-CN": createEmptyFormValue()
  };
}

function emptyExistingState(): ExistingTranslationState {
  return {
    "en-US": null,
    "zh-CN": null
  };
}

function toFormValue(translation: ArticleTranslation | null): TranslationMetadataFormValue {
  if (!translation) {
    return createEmptyFormValue();
  }

  return {
    seoDescription: translation.seoDescription ?? "",
    seoTitle: translation.seoTitle ?? "",
    publishedAt: toDateTimeLocalValue(translation.publishedAt),
    slug: translation.slug,
    summary: translation.summary ?? "",
    title: translation.title
  };
}

function toNullableValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPublishedAtPayload(value: string): string | undefined {
  return dateTimeLocalToIso(value);
}

function buildState(detail: ArticleDetail): {
  existingTranslations: ExistingTranslationState;
  forms: TranslationFormState;
} {
  const existingTranslations = emptyExistingState();
  const forms = emptyFormState();

  for (const translation of detail.translations) {
    existingTranslations[translation.locale] = translation;
    forms[translation.locale] = toFormValue(translation);
  }

  return {
    existingTranslations,
    forms
  };
}

function isSlugDuplicateError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("slug");
}

function oppositeLocale(locale: ArticleLocale): ArticleLocale {
  return locale === "zh-CN" ? "en-US" : "zh-CN";
}

function hasTranslatableMetadata(value: TranslationMetadataFormValue): boolean {
  return Object.values(value).some((field) => field.trim().length > 0);
}

function hasSeoGenerationSource(value: TranslationMetadataFormValue): boolean {
  return [value.title, value.summary].some((field) => field.trim().length > 0);
}

export function ArticleTranslationEditPage({ articleId }: ArticleTranslationEditPageProps): ReactElement {
  const t = useT();
  const [activeLocale, setActiveLocale] = useState<ArticleLocale>("zh-CN");
  const [articleDetail, setArticleDetail] = useState<ArticleDetail | null>(null);
  const [existingTranslations, setExistingTranslations] = useState<ExistingTranslationState>(() => emptyExistingState());
  const [forms, setForms] = useState<TranslationFormState>(() => emptyFormState());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingSeo, setIsGeneratingSeo] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const activeForm = forms[activeLocale];
  const activeTranslation = existingTranslations[activeLocale];
  const sourceLocale = oppositeLocale(activeLocale);
  const pageTitle = useMemo(() => `${t("article.metadataTitle")} #${articleId}`, [articleId, t]);

  useEffect(() => {
    let isMounted = true;

    async function loadArticle(): Promise<void> {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const detail = await articleApi.getArticle(articleId);
        const nextState = buildState(detail);

        if (isMounted) {
          setArticleDetail(detail);
          setExistingTranslations(nextState.existingTranslations);
          setForms(nextState.forms);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : t("article.metadataLoadFailed"));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadArticle();

    return () => {
      isMounted = false;
    };
  }, [articleId, t]);

  function updateActiveForm(value: TranslationMetadataFormValue): void {
    setForms((currentForms) => ({
      ...currentForms,
      [activeLocale]: value
    }));
  }

  function updateActiveFormField(field: keyof TranslationMetadataFormValue, value: string): void {
    updateActiveForm({
      ...activeForm,
      [field]: value
    });
  }

  async function handleSave(): Promise<void> {
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const payload = {
        publishedAt: activeTranslation?.publishedVersionId != null ? toPublishedAtPayload(activeForm.publishedAt) : undefined,
        seoDescription: toNullableValue(activeForm.seoDescription),
        seoTitle: toNullableValue(activeForm.seoTitle),
        slug: activeForm.slug.trim(),
        summary: toNullableValue(activeForm.summary),
        title: activeForm.title.trim()
      };
      const response = activeTranslation
        ? await articleApi.updateTranslation(articleId, activeLocale, payload)
        : await articleApi.createTranslation(articleId, { ...payload, locale: activeLocale });

      setExistingTranslations((currentTranslations) => ({
        ...currentTranslations,
        [activeLocale]: response.translation
      }));
      setForms((currentForms) => ({
        ...currentForms,
        [activeLocale]: toFormValue(response.translation)
      }));
      setSuccessMessage(t("article.metadataSaved"));
    } catch (error) {
      setErrorMessage(
        isSlugDuplicateError(error)
          ? t("article.slugDuplicate")
          : error instanceof Error ? error.message : t("article.metadataSaveFailed")
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTranslateMetadata(): Promise<void> {
    const sourceForm = forms[sourceLocale];

    if (!hasTranslatableMetadata(sourceForm)) {
      setErrorMessage(t("article.translateSourceMissing"));
      return;
    }

    setIsTranslating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await translationApi.translate({
        fields: {
          seoDescription: sourceForm.seoDescription,
          seoTitle: sourceForm.seoTitle,
          slug: sourceForm.slug,
          summary: sourceForm.summary,
          title: sourceForm.title
        },
        sourceLocale,
        targetLocale: activeLocale
      });
      const translatedFields = response.translation.fields;

      setForms((currentForms) => ({
        ...currentForms,
        [activeLocale]: {
          seoDescription: translatedFields.seoDescription ?? "",
          seoTitle: translatedFields.seoTitle ?? "",
          slug: activeForm.slug.trim() || createUuidSlug(),
          summary: translatedFields.summary ?? "",
          title: translatedFields.title ?? ""
        }
      }));
      setSuccessMessage(t("article.translateReady"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("article.translateFailed"));
    } finally {
      setIsTranslating(false);
    }
  }

  async function handleGenerateSeo(): Promise<void> {
    if (!hasSeoGenerationSource(activeForm)) {
      setErrorMessage(t("article.seoGenerateSourceMissing"));
      setSuccessMessage(null);
      return;
    }

    setIsGeneratingSeo(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await translationApi.generateSeo({
        locale: activeLocale,
        summary: activeForm.summary,
        title: activeForm.title
      });
      const generatedFields = response.seo.fields;

      setForms((currentForms) => ({
        ...currentForms,
        [activeLocale]: {
          ...currentForms[activeLocale],
          seoDescription: generatedFields.seoDescription,
          seoTitle: generatedFields.seoTitle
        }
      }));
      setSuccessMessage(t("article.seoGenerateReady"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("article.seoGenerateFailed"));
    } finally {
      setIsGeneratingSeo(false);
    }
  }

  return (
    <AdminLayout>
      <section className="admin-page-header">
        <div>
          <p className="admin-kicker">{t("nav.articles")}</p>
          <h2>{pageTitle}</h2>
        </div>
        <a className="liax-link" href="#articles">
          {t("article.backToList")}
        </a>
      </section>

      <section className="liax-card admin-metadata-card">
        <div className="liax-card__header">
          <LocaleTabs activeLocale={activeLocale} onChange={setActiveLocale} />
        </div>
        <div className="liax-card__body">
          {isLoading ? (
            <p className="admin-muted-text">{t("article.metadataLoading")}</p>
          ) : null}

          {!isLoading && articleDetail ? (
            <>
              <div className="admin-metadata-context">
                <span>{t("article.status")}: {articleDetail.article.status}</span>
                <span>{t("article.translationStatus")}: {activeTranslation ? t("article.translation.metadata") : t("article.translation.missing")}</span>
              </div>

              <div className="admin-translation-tools">
                <button
                  className="liax-button"
                  disabled={isTranslating || isSaving || isGeneratingSeo}
                  onClick={() => void handleTranslateMetadata()}
                  type="button"
                >
                  {isTranslating
                    ? t("article.translating")
                    : `${t("article.translateFrom")} ${sourceLocale}`}
                </button>
              </div>

              <SeoFields
                canGenerateSeo={hasSeoGenerationSource(activeForm)}
                disabled={isSaving || isTranslating || isGeneratingSeo}
                isGeneratingSeo={isGeneratingSeo}
                onChange={updateActiveForm}
                onGenerateSeo={() => void handleGenerateSeo()}
                value={activeForm}
              />

              {activeTranslation?.publishedVersionId != null ? (
                <label className="admin-form-field">
                  <span>{t("article.publishedAt")}</span>
                  <input
                    disabled={isSaving || isTranslating || isGeneratingSeo}
                    onChange={(event) => updateActiveFormField("publishedAt", event.target.value)}
                    type="datetime-local"
                    value={activeForm.publishedAt}
                  />
                  <small>{t("article.publishedAtHelp")}</small>
                </label>
              ) : null}

              <div className="admin-form-actions">
                <button
                  className="liax-button liax-button--primary"
                  disabled={isSaving || isGeneratingSeo}
                  onClick={() => void handleSave()}
                  type="button"
                >
                  {isSaving ? t("article.metadataSaving") : t("article.metadataSave")}
                </button>
                <a className="liax-button" href={`#articles/${articleId}/${activeLocale}/content`}>
                  {t("article.markdownEdit")}
                </a>
              </div>
            </>
          ) : null}

          {successMessage ? (
            <p className="admin-success-text">{successMessage}</p>
          ) : null}

          {errorMessage ? (
            <p className="admin-error-text">{errorMessage}</p>
          ) : null}
        </div>
      </section>
    </AdminLayout>
  );
}
