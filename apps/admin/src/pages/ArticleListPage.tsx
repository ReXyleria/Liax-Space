import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactElement } from "react";

import { articleApi, type ArticleDetail, type ArticleLocale, type ArticleTranslation } from "../api/articleApi";
import { attachmentApi, type Attachment } from "../api/attachmentApi";
import { roleApi, type AdminRoleDefinition } from "../api/roleApi";
import { translationApi } from "../api/translationApi";
import { versionApi } from "../api/versionApi";
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
type VisibilityState = Record<ArticleLocale, string[]>;

function editableVisibleRoles(roles: string[]): string[] {
  return roles.filter((role) => role !== "admin");
}

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

function preferredTranslation(translations: ArticleTranslation[]): ArticleTranslation | null {
  return findTranslation(translations, "zh-CN") ?? findTranslation(translations, "en-US");
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

function emptyVisibilityState(): VisibilityState {
  return {
    "en-US": [],
    "zh-CN": []
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
  visibility: VisibilityState;
} {
  const existingTranslations = emptyExistingState();
  const forms = emptyFormState();
  const visibility = emptyVisibilityState();

  for (const translation of detail.translations) {
    existingTranslations[translation.locale] = translation;
    forms[translation.locale] = toFormValue(translation);
    visibility[translation.locale] = editableVisibleRoles(translation.allowedRoles ?? []);
  }

  return { existingTranslations, forms, visibility };
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
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getSnapshot());
  const [articles, setArticles] = useState<ArticleDetail[]>([]);
  const [roleOptions, setRoleOptions] = useState<AdminRoleDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<ArticleDetail | null>(null);
  const [activeLocale, setActiveLocale] = useState<ArticleLocale>("zh-CN");
  const [existingTranslations, setExistingTranslations] = useState<ExistingTranslationState>(() => emptyExistingState());
  const [allowedRoles, setAllowedRoles] = useState<VisibilityState>(() => emptyVisibilityState());
  const [forms, setForms] = useState<TranslationFormState>(() => emptyFormState());
  const [status, setStatus] = useState("draft");
  const [coverAttachmentId, setCoverAttachmentId] = useState("");
  const [uploadedCoverAttachment, setUploadedCoverAttachment] = useState<Attachment | null>(null);
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isGeneratingSeo, setIsGeneratingSeo] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isImportingMarkdown, setIsImportingMarkdown] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);
  const [modalSuccessMessage, setModalSuccessMessage] = useState<string | null>(null);
  const formatterLocale = useMemo(() => navigator.language || "zh-CN", []);
  const activeForm = forms[activeLocale];
  const activeTranslation = existingTranslations[activeLocale];
  const editingArticleTitle = editingArticle ? preferredTranslation(editingArticle.translations)?.title : null;
  const canCreateArticle = hasAnyPermission(authState.user, ["article:create"]);
  const canEditArticle = hasAnyPermission(authState.user, ["article:update"]);

  useEffect(() => authStore.subscribe(setAuthState), []);

  useEffect(() => {
    if (!canEditArticle) {
      return;
    }

    let isMounted = true;

    async function loadRoles(): Promise<void> {
      try {
        const response = await roleApi.listRoles();

        if (isMounted) {
          setRoleOptions(response.roles.filter((role) => role.roleKey !== "admin"));
        }
      } catch {
        if (isMounted) {
          setRoleOptions([]);
        }
      }
    }

    void loadRoles();

    return () => {
      isMounted = false;
    };
  }, [canEditArticle]);

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
    setAllowedRoles(nextState.visibility);
    setStatus(detail.article.status || "draft");
    setCoverAttachmentId(detail.article.coverAttachmentId === null ? "" : String(detail.article.coverAttachmentId));
    setUploadedCoverAttachment(null);
    setSelectedImportFile(null);
    setImportProgress(null);
    setIsGeneratingSeo(false);
    setIsImportingMarkdown(false);
    setModalErrorMessage(null);
    setModalSuccessMessage(null);

    if (importFileInputRef.current) {
      importFileInputRef.current.value = "";
    }
  }

  function closeConfigModal(): void {
    if (isSavingConfig || isGeneratingSeo || isUploadingCover || isImportingMarkdown) {
      return;
    }

    setEditingArticle(null);
    setUploadedCoverAttachment(null);
    setSelectedImportFile(null);
    setImportProgress(null);
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

  function roleDisplayName(role: AdminRoleDefinition): string {
    if (!role.builtIn) {
      return role.displayName;
    }

    const localizedName = t(`users.role.${role.roleKey}`);
    return localizedName.startsWith("[missing:") ? role.displayName : localizedName;
  }

  function toggleActiveAllowedRole(roleKey: string): void {
    setAllowedRoles((currentVisibility) => {
      const currentRoles = currentVisibility[activeLocale] ?? [];
      const nextRoles = currentRoles.includes(roleKey)
        ? currentRoles.filter((item) => item !== roleKey)
        : [...currentRoles, roleKey];

      return {
        ...currentVisibility,
        [activeLocale]: nextRoles
      };
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

  async function handleCoverImageSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    const isImageFile = file.type.startsWith("image/") || /\.(?:avif|gif|jpe?g|png|webp)$/i.test(file.name);

    if (!isImageFile) {
      setModalErrorMessage(t("article.coverUploadImageRequired"));
      setModalSuccessMessage(null);
      input.value = "";
      return;
    }

    setIsUploadingCover(true);
    setModalErrorMessage(null);
    setModalSuccessMessage(null);

    try {
      const result = await attachmentApi.uploadAttachment(file);

      setCoverAttachmentId(String(result.attachment.id));
      setUploadedCoverAttachment(result.attachment);
      setModalSuccessMessage(t("article.coverUploaded"));
    } catch (error) {
      setModalErrorMessage(error instanceof Error ? error.message : t("article.coverUploadFailed"));
    } finally {
      setIsUploadingCover(false);
      input.value = "";
    }
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
          allowedRoles: editableVisibleRoles(allowedRoles[activeLocale] ?? []),
          seoDescription: toNullableValue(activeForm.seoDescription),
          seoTitle: toNullableValue(activeForm.seoTitle),
          slug: activeForm.slug.trim(),
          summary: toNullableValue(activeForm.seoDescription) ? null : toNullableValue(activeForm.summary),
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
      setAllowedRoles(nextState.visibility);
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

  function formatBytes(value: number): string {
    if (value >= 1024 * 1024) {
      return `${(value / 1024 / 1024).toFixed(1)} MB`;
    }

    if (value >= 1024) {
      return `${Math.round(value / 1024)} KB`;
    }

    return `${value} B`;
  }

  async function handleImportMarkdownFile(): Promise<void> {
    if (!editingArticle) {
      return;
    }

    if (!activeTranslation) {
      setModalErrorMessage(t("article.markdownNeedsMetadata"));
      setModalSuccessMessage(null);
      return;
    }

    if (!selectedImportFile) {
      setModalErrorMessage(t("article.importFileRequired"));
      setModalSuccessMessage(null);
      return;
    }

    setIsImportingMarkdown(true);
    setImportProgress(0);
    setModalErrorMessage(null);
    setModalSuccessMessage(null);

    try {
      const response = await versionApi.importMarkdownFile(
        editingArticle.article.id,
        activeLocale,
        selectedImportFile,
        setImportProgress
      );
      const nextDetail = await articleApi.getArticle(editingArticle.article.id);
      const nextState = buildTranslationState(nextDetail);

      setArticles((currentArticles) => currentArticles.map((item) => (
        item.article.id === nextDetail.article.id ? nextDetail : item
      )));
      setEditingArticle(nextDetail);
      setExistingTranslations(nextState.existingTranslations);
      setForms(nextState.forms);
      setAllowedRoles(nextState.visibility);
      setSelectedImportFile(null);
      setModalSuccessMessage(
        `${response.unchanged ? t("article.importUnchanged") : t("article.importSaved")} ${t("article.versionNo")} ${response.version.versionNo} · ${formatBytes(response.version.contentSizeBytes)}`
      );

      if (importFileInputRef.current) {
        importFileInputRef.current.value = "";
      }
    } catch (error) {
      setModalErrorMessage(error instanceof Error ? error.message : t("article.importFailed"));
    } finally {
      setIsImportingMarkdown(false);
      setImportProgress(null);
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
                  <th>{t("article.field.title")}</th>
                  <th>{t("article.status")}</th>
                  <th>{t("article.translationStatus")}</th>
                  <th>{t("article.updatedAt")}</th>
                  <th>{t("article.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((item) => {
                  const titleTranslation = preferredTranslation(item.translations);
                  const displayTitle = titleTranslation?.title?.trim()
                    ? titleTranslation.title
                    : t("article.untitledDraft").replace("{id}", String(item.article.id));

                  return (
                  <tr key={item.article.id}>
                    <td className="admin-article-title-cell">
                      <strong>{displayTitle}</strong>
                      <small>
                        {titleTranslation
                          ? `${titleTranslation.locale} · ${titleTranslation.slug}`
                          : `${t("article.id")} ${item.article.id}`}
                      </small>
                    </td>
                    <td>{t(`article.status.${item.article.status}`)}</td>
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
                          <a className="liax-button liax-button--primary" href={`#articles/${item.article.id}/edit`}>
                            {t("article.editContent")}
                          </a>
                          <button
                            className="liax-button"
                            onClick={() => openConfigModal(item)}
                            type="button"
                          >
                            {t("article.configure")}
                          </button>
                        </div>
                      ) : (
                        <span className="admin-muted-text">{t("article.readOnly")}</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
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
                <p className="admin-kicker">{t("nav.articles")}</p>
                <h3 id="article-config-title">{editingArticleTitle ?? t("article.configTitle")}</h3>
              </div>
              <button className="liax-button" disabled={isSavingConfig || isGeneratingSeo || isUploadingCover || isImportingMarkdown} onClick={closeConfigModal} type="button">
                {t("article.cancel")}
              </button>
            </header>

            <div className="admin-modal__body">
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

                  <div className="admin-cover-upload-panel">
                    <label className="admin-form-field">
                      <span>{t("article.coverImage")}</span>
                      <input
                        accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                        disabled={isSavingConfig || isGeneratingSeo || isUploadingCover}
                        onChange={(event) => void handleCoverImageSelected(event)}
                        type="file"
                      />
                      <small>{isUploadingCover ? t("article.coverUploading") : t("article.coverAttachmentHelp")}</small>
                    </label>
                    <div className="admin-cover-upload-panel__current">
                      {uploadedCoverAttachment?.publicUrl ? (
                        <img alt={uploadedCoverAttachment.originalFilename} src={uploadedCoverAttachment.publicUrl} />
                      ) : null}
                      <div>
                        <strong>
                          {uploadedCoverAttachment
                            ? uploadedCoverAttachment.originalFilename
                            : coverAttachmentId ? t("article.coverCurrent") : t("article.coverEmpty")}
                        </strong>
                        {coverAttachmentId ? <span>{t("article.coverSelected")}</span> : null}
                      </div>
                      {coverAttachmentId ? (
                        <button
                          className="liax-link"
                          disabled={isSavingConfig || isGeneratingSeo || isUploadingCover}
                          onClick={() => {
                            setCoverAttachmentId("");
                            setUploadedCoverAttachment(null);
                          }}
                          type="button"
                        >
                          {t("article.coverClear")}
                        </button>
                      ) : null}
                    </div>
                  </div>
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

              <section className="admin-article-config-section">
                <h4>{t("article.visibilityTitle")}</h4>
                <p className="admin-muted-text admin-article-config-help">{t("article.visibilityHelp")}</p>
                <div className="admin-role-checkbox-grid admin-role-checkbox-grid--compact">
                  {roleOptions.map((role) => (
                    <label className="admin-role-checkbox" key={role.roleKey}>
                      <input
                        checked={(allowedRoles[activeLocale] ?? []).includes(role.roleKey)}
                        disabled={isSavingConfig || isGeneratingSeo || isImportingMarkdown || !activeTranslation}
                        onChange={() => toggleActiveAllowedRole(role.roleKey)}
                        type="checkbox"
                      />
                      <span>
                        <strong>{roleDisplayName(role)}</strong>
                        <code>{role.roleKey}</code>
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="admin-article-config-section">
                <h4>{t("article.importTitle")}</h4>
                <div className="admin-markdown-import admin-markdown-import--modal">
                  <label className="admin-form-field admin-markdown-import__file">
                    <span>{t("article.importFile")}</span>
                    <input
                      accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain"
                      disabled={isImportingMarkdown || !activeTranslation}
                      onChange={(event) => setSelectedImportFile(event.target.files?.[0] ?? null)}
                      ref={importFileInputRef}
                      type="file"
                    />
                  </label>
                  <button
                    className="liax-button"
                    disabled={isImportingMarkdown || !selectedImportFile || !activeTranslation}
                    onClick={() => void handleImportMarkdownFile()}
                    type="button"
                  >
                    {isImportingMarkdown ? t("article.importing") : t("article.importAction")}
                  </button>
                  {selectedImportFile ? (
                    <p className="admin-muted-text">{selectedImportFile.name} · {formatBytes(selectedImportFile.size)}</p>
                  ) : null}
                  {typeof importProgress === "number" ? (
                    <div className="admin-markdown-import__progress" aria-label={t("article.importProgress")}>
                      <span style={{ width: `${importProgress}%` }} />
                    </div>
                  ) : null}
                </div>
              </section>

              <div className="admin-form-actions">
                <button
                  className="liax-button liax-button--primary"
                  disabled={isSavingConfig || isGeneratingSeo || isUploadingCover || isImportingMarkdown}
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
