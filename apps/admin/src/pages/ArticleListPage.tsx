import { useEffect, useMemo, useState, type ReactElement } from "react";

import { articleApi, type ArticleDetail, type ArticleLocale, type ArticleTranslation } from "../api/articleApi";
import { translationApi } from "../api/translationApi";
import { LocaleTabs } from "../components/LocaleTabs";
import { SeoFields, type TranslationMetadataFormValue } from "../components/SeoFields";
import { AdminLayout } from "../layout/AdminLayout";
import { hasAnyPermission } from "../auth/permissions";
import { useT } from "../i18n/useT";
import { authStore, type AuthState } from "../stores/authStore";
import { dateTimeLocalToIso, toDateTimeLocalValue } from "../utils/dateTime";

const articleLocales: ArticleLocale[] = ["zh-CN", "en-US"];
const articleStatusOptions = ["draft", "active", "archived"] as const;

type TranslationStatus = "missing" | "metadata" | "draft" | "published";
type TranslationFormState = Record<ArticleLocale, TranslationMetadataFormValue>;
type ExistingTranslationState = Record<ArticleLocale, ArticleTranslation | null>;

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function findTranslation(translations: ArticleTranslation[], locale: ArticleLocale): ArticleTranslation | null {
  return translations.find((translation) => translation.locale === locale) ?? null;
}

function translationStatus(translation: ArticleTranslation | null): TranslationStatus {
  if (!translation) {
    return "missing";
  }

  if (translation.publishedVersionId !== null) {
    return "published";
  }

  if (translation.currentVersionId !== null) {
    return "draft";
  }

  return "metadata";
}

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

function buildTranslationState(detail: ArticleDetail): {
  existingTranslations: ExistingTranslationState;
  forms: TranslationFormState;
} {
  const existingTranslations = emptyExistingState();
  const forms = emptyFormState();

  for (const translation of detail.translations) {
    existingTranslations[translation.locale] = translation;
    forms[translation.locale] = toFormValue(translation);
  }

  return { existingTranslations, forms };
}

function toNullableValue(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPublishedAtPayload(value: string): string | undefined {
  return dateTimeLocalToIso(value);
}

function hasMetadataInput(value: TranslationMetadataFormValue): boolean {
  return [value.title, value.seoTitle, value.seoDescription, value.summary].some((field) => {
    return field.trim().length > 0;
  });
}

function hasSeoGenerationSource(value: TranslationMetadataFormValue): boolean {
  return [value.title, value.summary].some((field) => field.trim().length > 0);
}

function mergeTranslation(translations: ArticleTranslation[], nextTranslation: ArticleTranslation | null): ArticleTranslation[] {
  if (!nextTranslation) {
    return translations;
  }

  const existingIndex = translations.findIndex((translation) => translation.locale === nextTranslation.locale);

  if (existingIndex === -1) {
    return [...translations, nextTranslation];
  }

  return translations.map((translation, index) => (index === existingIndex ? nextTranslation : translation));
}

function isSlugDuplicateError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("slug");
}

export function ArticleListPage(): ReactElement {
  const t = useT();
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getSnapshot());
  const [articles, setArticles] = useState<ArticleDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<ArticleDetail | null>(null);
  const [activeLocale, setActiveLocale] = useState<ArticleLocale>("zh-CN");
  const [existingTranslations, setExistingTranslations] = useState<ExistingTranslationState>(() => emptyExistingState());
  const [forms, setForms] = useState<TranslationFormState>(() => emptyFormState());
  const [status, setStatus] = useState("draft");
  const [coverAttachmentId, setCoverAttachmentId] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isGeneratingSeo, setIsGeneratingSeo] = useState(false);
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);
  const [modalSuccessMessage, setModalSuccessMessage] = useState<string | null>(null);
  const formatterLocale = useMemo(() => navigator.language || "zh-CN", []);
  const activeForm = forms[activeLocale];
  const activeTranslation = existingTranslations[activeLocale];
  const canCreateArticle = hasAnyPermission(authState.user, ["article:create"]);
  const canEditArticle = hasAnyPermission(authState.user, ["article:update"]);

  useEffect(() => authStore.subscribe(setAuthState), []);

  useEffect(() => {
    let isMounted = true;

    async function loadArticles(): Promise<void> {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await articleApi.listArticles({ limit: 50 });

        if (isMounted) {
          if (!Array.isArray(response.articles)) {
            throw new Error(t("article.listLoadFailed"));
          }

          setArticles(response.articles);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : t("article.listLoadFailed"));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadArticles();

    return () => {
      isMounted = false;
    };
  }, [t]);

  function openConfigModal(detail: ArticleDetail): void {
    const nextState = buildTranslationState(detail);

    setEditingArticle(detail);
    setActiveLocale("zh-CN");
    setExistingTranslations(nextState.existingTranslations);
    setForms(nextState.forms);
    setStatus(detail.article.status || "draft");
    setCoverAttachmentId(detail.article.coverAttachmentId === null ? "" : String(detail.article.coverAttachmentId));
    setIsGeneratingSeo(false);
    setModalErrorMessage(null);
    setModalSuccessMessage(null);
  }

  function closeConfigModal(): void {
    if (isSavingConfig || isGeneratingSeo) {
      return;
    }

    setEditingArticle(null);
    setModalErrorMessage(null);
    setModalSuccessMessage(null);
  }

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

  function parseCoverAttachmentId(): number | null {
    const trimmedValue = coverAttachmentId.trim();

    if (!trimmedValue) {
      return null;
    }

    const value = Number(trimmedValue);

    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(t("article.coverAttachmentInvalid"));
    }

    return value;
  }

  async function handleSaveConfig(): Promise<void> {
    if (!editingArticle) {
      return;
    }

    const shouldSaveMetadata = activeTranslation !== null || hasMetadataInput(activeForm);

    if (shouldSaveMetadata && !activeForm.title.trim()) {
      setModalErrorMessage(t("article.titleRequired"));
      setModalSuccessMessage(null);
      return;
    }

    setIsSavingConfig(true);
    setModalErrorMessage(null);
    setModalSuccessMessage(null);

    try {
      const parsedCoverAttachmentId = parseCoverAttachmentId();
      const articleResponse = await articleApi.updateArticle(editingArticle.article.id, {
        coverAttachmentId: parsedCoverAttachmentId,
        status
      });
      let nextTranslation: ArticleTranslation | null = null;

      if (shouldSaveMetadata) {
        const payload = {
          publishedAt: activeTranslation?.publishedVersionId != null ? toPublishedAtPayload(activeForm.publishedAt) : undefined,
          seoDescription: toNullableValue(activeForm.seoDescription),
          seoTitle: toNullableValue(activeForm.seoTitle),
          slug: activeForm.slug.trim(),
          summary: toNullableValue(activeForm.summary),
          title: activeForm.title.trim()
        };
        const translationResponse = activeTranslation
          ? await articleApi.updateTranslation(editingArticle.article.id, activeLocale, payload)
          : await articleApi.createTranslation(editingArticle.article.id, { ...payload, locale: activeLocale });

        nextTranslation = translationResponse.translation;
      }

      const nextDetail = {
        article: articleResponse.article,
        translations: mergeTranslation(editingArticle.translations, nextTranslation)
      };
      const nextState = buildTranslationState(nextDetail);

      setArticles((currentArticles) => currentArticles.map((item) => (
        item.article.id === nextDetail.article.id ? nextDetail : item
      )));
      setEditingArticle(nextDetail);
      setExistingTranslations(nextState.existingTranslations);
      setForms(nextState.forms);
      setCoverAttachmentId(nextDetail.article.coverAttachmentId === null ? "" : String(nextDetail.article.coverAttachmentId));
      setStatus(nextDetail.article.status);
      setModalSuccessMessage(t("article.configSaved"));
    } catch (error) {
      setModalErrorMessage(
        isSlugDuplicateError(error)
          ? t("article.slugDuplicate")
          : error instanceof Error ? error.message : t("article.configSaveFailed")
      );
    } finally {
      setIsSavingConfig(false);
    }
  }

  async function handleGenerateSeo(): Promise<void> {
    if (!hasSeoGenerationSource(activeForm)) {
      setModalErrorMessage(t("article.seoGenerateSourceMissing"));
      setModalSuccessMessage(null);
      return;
    }

    setIsGeneratingSeo(true);
    setModalErrorMessage(null);
    setModalSuccessMessage(null);

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
      setModalSuccessMessage(t("article.seoGenerateReady"));
    } catch (error) {
      setModalErrorMessage(error instanceof Error ? error.message : t("article.seoGenerateFailed"));
    } finally {
      setIsGeneratingSeo(false);
    }
  }

  return (
    <AdminLayout>
      <section className="admin-page-header">
        <div>
          <p className="admin-kicker">{t("nav.articles")}</p>
          <h2>{t("article.listTitle")}</h2>
        </div>
        {canCreateArticle ? (
          <a className="liax-button liax-button--brand" href="#articles/new">
            {t("article.create")}
          </a>
        ) : null}
      </section>

      <section className="liax-card admin-table-card" aria-label={t("article.listTitle")}>
        <div className="liax-card__body">
          {isLoading ? (
            <p className="admin-muted-text">{t("article.listLoading")}</p>
          ) : null}

          {errorMessage ? (
            <p className="admin-error-text">{errorMessage}</p>
          ) : null}

          {!isLoading && !errorMessage && articles.length === 0 ? (
            <p className="admin-muted-text">{t("article.listEmpty")}</p>
          ) : null}

          {!isLoading && !errorMessage && articles.length > 0 ? (
            <table className="admin-article-table">
              <thead>
                <tr>
                  <th>{t("article.id")}</th>
                  <th>{t("article.status")}</th>
                  <th>{t("article.translationStatus")}</th>
                  <th>{t("article.updatedAt")}</th>
                  <th>{t("article.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((item) => (
                  <tr key={item.article.id}>
                    <td>{item.article.id}</td>
                    <td>{item.article.status}</td>
                    <td>
                      <div className="admin-translation-badges">
                        {articleLocales.map((locale) => {
                          const status = translationStatus(findTranslation(item.translations, locale));

                          return (
                            <span className="admin-status-badge" data-status={status} key={locale}>
                              {locale}: {t(`article.translation.${status}`)}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td>{formatDate(item.article.updatedAt, formatterLocale)}</td>
                    <td>
                      {canEditArticle ? (
                        <div className="admin-article-actions">
                          <button
                            className="liax-button"
                            onClick={() => openConfigModal(item)}
                            type="button"
                          >
                            {t("article.editConfig")}
                          </button>
                          <a className="liax-link" href={`#articles/${item.article.id}/edit`}>
                            {t("article.openFullEditor")}
                          </a>
                        </div>
                      ) : (
                        <span className="admin-muted-text">{t("article.readOnly")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </section>

      {editingArticle ? (
        <div className="admin-modal-backdrop">
          <section
            aria-labelledby="article-config-title"
            aria-modal="true"
            className="admin-modal admin-article-config-modal"
            role="dialog"
          >
            <header className="admin-modal__header">
              <div>
                <p className="admin-kicker">{t("article.id")} #{editingArticle.article.id}</p>
                <h3 id="article-config-title">{t("article.configTitle")}</h3>
              </div>
              <button className="liax-button" disabled={isSavingConfig || isGeneratingSeo} onClick={closeConfigModal} type="button">
                {t("article.cancel")}
              </button>
            </header>

            <div className="admin-modal__body">
              <p className="admin-muted-text admin-article-config-help">{t("article.configHelp")}</p>

              <section className="admin-article-config-section">
                <h4>{t("article.basicConfig")}</h4>
                <div className="admin-article-config-grid">
                  <label className="admin-form-field">
                    <span>{t("article.status")}</span>
                    <select disabled={isSavingConfig || isGeneratingSeo} onChange={(event) => setStatus(event.target.value)} value={status}>
                      {articleStatusOptions.map((option) => (
                        <option key={option} value={option}>
                          {t(`article.status.${option}`)}
                        </option>
                      ))}
                    </select>
                    <small>{t("article.statusHelp")}</small>
                  </label>

                  <label className="admin-form-field">
                    <span>{t("article.coverAttachmentId")}</span>
                    <input
                      disabled={isSavingConfig || isGeneratingSeo}
                      min="1"
                      onChange={(event) => setCoverAttachmentId(event.target.value)}
                      placeholder="5"
                      type="number"
                      value={coverAttachmentId}
                    />
                    <small>{t("article.coverAttachmentHelp")}</small>
                  </label>
                </div>
              </section>

              <section className="admin-article-config-section">
                <div className="admin-article-config-section__header">
                  <h4>{t("article.metadataTitle")}</h4>
                  <LocaleTabs activeLocale={activeLocale} onChange={setActiveLocale} />
                </div>
                <p className="admin-muted-text admin-article-config-help">{t("article.metadataOptionalHelp")}</p>
                <SeoFields
                  canGenerateSeo={hasSeoGenerationSource(activeForm)}
                  disabled={isSavingConfig || isGeneratingSeo}
                  isGeneratingSeo={isGeneratingSeo}
                  onChange={updateActiveForm}
                  onGenerateSeo={() => void handleGenerateSeo()}
                  value={activeForm}
                />
                {activeTranslation?.publishedVersionId != null ? (
                  <label className="admin-form-field">
                    <span>{t("article.publishedAt")}</span>
                    <input
                      disabled={isSavingConfig || isGeneratingSeo}
                      onChange={(event) => updateActiveFormField("publishedAt", event.target.value)}
                      type="datetime-local"
                      value={activeForm.publishedAt}
                    />
                    <small>{t("article.publishedAtHelp")}</small>
                  </label>
                ) : null}
              </section>

              <div className="admin-form-actions">
                <button
                  className="liax-button liax-button--primary"
                  disabled={isSavingConfig || isGeneratingSeo}
                  onClick={() => void handleSaveConfig()}
                  type="button"
                >
                  {isSavingConfig ? t("article.metadataSaving") : t("article.saveConfig")}
                </button>
                <a className="liax-button" href={`#articles/${editingArticle.article.id}/${activeLocale}/content`}>
                  {t("article.markdownEdit")}
                </a>
                <a className="liax-link" href={`#articles/${editingArticle.article.id}/edit`}>
                  {t("article.openFullEditor")}
                </a>
              </div>

              {modalSuccessMessage ? (
                <p className="admin-success-text">{modalSuccessMessage}</p>
              ) : null}

              {modalErrorMessage ? (
                <p className="admin-error-text">{modalErrorMessage}</p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </AdminLayout>
  );
}
