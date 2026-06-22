import { useEffect, useMemo, useState, type ChangeEvent, type MouseEvent, type ReactElement } from "react";

import { articleApi, type ArticleDetail, type ArticleLocale, type ArticleTranslation } from "../api/articleApi";
import { attachmentApi, type Attachment } from "../api/attachmentApi";
import { roleApi, type AdminRoleDefinition } from "../api/roleApi";
import { versionApi } from "../api/versionApi";
import { LocaleTabs } from "../components/LocaleTabs";
import { AdminLayout } from "../layout/AdminLayout";
import { hasAnyPermission } from "../auth/permissions";
import { AdminLoadingSkeleton } from "../components/AdminLoadingSkeleton";
import { useT } from "../i18n/useT";
import { authStore, type AuthState } from "../stores/authStore";
import { dateTimeLocalToIso, toDateTimeLocalValue } from "../utils/dateTime";

const articleLocales: ArticleLocale[] = ["zh-CN", "en-US"];
const fallbackRoleOptions: AdminRoleDefinition[] = [
  {
    builtIn: true,
    createdAt: "",
    displayName: "Guest",
    permissions: [],
    roleKey: "guest",
    updatedAt: ""
  },
  {
    builtIn: false,
    createdAt: "",
    displayName: "SSVIP",
    permissions: [],
    roleKey: "ssvip",
    updatedAt: ""
  },
  {
    builtIn: false,
    createdAt: "",
    displayName: "SVIP",
    permissions: [],
    roleKey: "svip",
    updatedAt: ""
  }
];

type TranslationStatus = "missing" | "metadata" | "draft" | "published";
type ArticlePublishState = "published" | "unpublished";
type ExistingTranslationState = Record<ArticleLocale, ArticleTranslation | null>;
type PublishedAtState = Record<ArticleLocale, string>;
type VisibilityState = Record<ArticleLocale, string[]>;

function editableVisibleRoles(roles: string[]): string[] {
  return roles.filter((role) => role !== "admin");
}

function formatDate(value: string | null | undefined, locale: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
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

function preferredPublishedTranslation(translations: ArticleTranslation[]): ArticleTranslation | null {
  return translations.find((translation) => translation.publishedAt !== null) ?? preferredTranslation(translations);
}

function latestPublishedAtTimestamp(translations: ArticleTranslation[]): number {
  const timestamps = translations
    .map((translation) => translation.publishedAt ? new Date(translation.publishedAt).getTime() : Number.NaN)
    .filter(Number.isFinite);

  return timestamps.length > 0 ? Math.max(...timestamps) : 0;
}

function sortArticleDetailsByPublishedAt(articles: ArticleDetail[]): ArticleDetail[] {
  return [...articles].sort((left, right) => {
    const publishedDifference = latestPublishedAtTimestamp(right.translations) - latestPublishedAtTimestamp(left.translations);

    if (publishedDifference !== 0) {
      return publishedDifference;
    }

    const updatedDifference = new Date(right.article.updatedAt).getTime() - new Date(left.article.updatedAt).getTime();

    if (updatedDifference !== 0) {
      return updatedDifference;
    }

    return right.article.id - left.article.id;
  });
}

function replaceArticleDetail(articles: ArticleDetail[], nextDetail: ArticleDetail): ArticleDetail[] {
  return sortArticleDetailsByPublishedAt(articles.map((item) => (
    item.article.id === nextDetail.article.id ? nextDetail : item
  )));
}

function preferredEditLocale(translations: ArticleTranslation[]): ArticleLocale {
  return preferredTranslation(translations)?.locale ?? "zh-CN";
}

function articlePublishState(detail: ArticleDetail): ArticlePublishState {
  return detail.translations.some((translation) => translation.publishedVersionId !== null) ? "published" : "unpublished";
}

function translationPublishState(translation: ArticleTranslation | null): ArticlePublishState {
  return translation && translation.publishedVersionId !== null ? "published" : "unpublished";
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

function emptyPublishedAtState(): PublishedAtState {
  return {
    "en-US": "",
    "zh-CN": ""
  };
}

function buildTranslationState(detail: ArticleDetail): {
  existingTranslations: ExistingTranslationState;
  publishedAt: PublishedAtState;
  visibility: VisibilityState;
} {
  const existingTranslations = emptyExistingState();
  const publishedAt = emptyPublishedAtState();
  const visibility = emptyVisibilityState();

  for (const translation of detail.translations) {
    existingTranslations[translation.locale] = translation;
    publishedAt[translation.locale] = toDateTimeLocalValue(translation.publishedAt);
    visibility[translation.locale] = editableVisibleRoles(translation.allowedRoles ?? []);
  }

  return { existingTranslations, publishedAt, visibility };
}

export function ArticleListPage(): ReactElement {
  const t = useT();
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getSnapshot());
  const [articles, setArticles] = useState<ArticleDetail[]>([]);
  const [roleOptions, setRoleOptions] = useState<AdminRoleDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<ArticleDetail | null>(null);
  const [activeLocale, setActiveLocale] = useState<ArticleLocale>("zh-CN");
  const [existingTranslations, setExistingTranslations] = useState<ExistingTranslationState>(() => emptyExistingState());
  const [allowedRoles, setAllowedRoles] = useState<VisibilityState>(() => emptyVisibilityState());
  const [publishedAtByLocale, setPublishedAtByLocale] = useState<PublishedAtState>(() => emptyPublishedAtState());
  const [coverAttachmentId, setCoverAttachmentId] = useState("");
  const [uploadedCoverAttachment, setUploadedCoverAttachment] = useState<Attachment | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isPublishingConfig, setIsPublishingConfig] = useState(false);
  const [isUnpublishingConfig, setIsUnpublishingConfig] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isDeletingArticle, setIsDeletingArticle] = useState(false);
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);
  const [modalSuccessMessage, setModalSuccessMessage] = useState<string | null>(null);
  const formatterLocale = useMemo(() => navigator.language || "zh-CN", []);
  const activeTranslation = existingTranslations[activeLocale];
  const activePublishState = translationPublishState(activeTranslation);
  const editingArticleTitle = editingArticle ? preferredTranslation(editingArticle.translations)?.title : null;
  const canCreateArticle = hasAnyPermission(authState.user, ["article:create"]);
  const canEditArticle = hasAnyPermission(authState.user, ["article:update"]);
  const canPublishArticle = hasAnyPermission(authState.user, ["article:publish"]);
  const canDeleteArticle = hasAnyPermission(authState.user, ["article:delete"]);
  const isConfigBusy = isSavingConfig || isPublishingConfig || isUnpublishingConfig || isUploadingCover || isDeletingArticle;

  useEffect(() => authStore.subscribe(setAuthState), []);

  useEffect(() => {
    let isMounted = true;

    async function loadRoles(): Promise<void> {
      try {
        const response = await roleApi.listRoles();

        if (isMounted) {
          setRoleOptions(response.roles.filter((role) => role.roleKey !== "admin"));
        }
      } catch {
        if (isMounted) {
          setRoleOptions(fallbackRoleOptions);
        }
      }
    }

    void loadRoles();

    return () => {
      isMounted = false;
    };
  }, []);

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

          setArticles(sortArticleDetailsByPublishedAt(response.articles));
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
    setActiveLocale(preferredEditLocale(detail.translations));
    setExistingTranslations(nextState.existingTranslations);
    setAllowedRoles(nextState.visibility);
    setPublishedAtByLocale(nextState.publishedAt);
    setCoverAttachmentId(detail.article.coverAttachmentId === null ? "" : String(detail.article.coverAttachmentId));
    setUploadedCoverAttachment(null);
    setIsPublishingConfig(false);
    setIsUnpublishingConfig(false);
    setIsDeletingArticle(false);
    setModalErrorMessage(null);
    setModalSuccessMessage(null);
  }

  function closeConfigModal(): void {
    if (isConfigBusy) {
      return;
    }

    setEditingArticle(null);
    setUploadedCoverAttachment(null);
    setModalErrorMessage(null);
    setModalSuccessMessage(null);
  }

  function closeConfigModalFromBackdrop(event: MouseEvent<HTMLDivElement>): void {
    if (event.target !== event.currentTarget) {
      return;
    }

    closeConfigModal();
  }

  function roleDisplayName(role: AdminRoleDefinition): string {
    const localizedName = t(`users.role.${role.roleKey}`);
    return localizedName.startsWith("[missing:") ? role.displayName : localizedName;
  }

  function roleLabelByKey(roleKey: string): string {
    const option = roleOptions.find((role) => role.roleKey === roleKey) ?? fallbackRoleOptions.find((role) => role.roleKey === roleKey);

    if (!option) {
      return roleKey;
    }

    return roleDisplayName(option);
  }

  function visibilityLabel(roles: readonly string[] | null | undefined): string {
    const normalizedRoles = [...new Set((roles ?? []).filter((role) => role !== "admin"))];

    if (normalizedRoles.length === 0 || normalizedRoles.includes("guest")) {
      return t("article.visibilityPublic");
    }

    const labels: string[] = [];

    if (normalizedRoles.includes("svip")) {
      labels.push(t("article.visibilitySvipAndAbove"));
    } else if (normalizedRoles.includes("ssvip")) {
      labels.push(roleLabelByKey("ssvip"));
    }

    for (const role of normalizedRoles) {
      if (role === "svip" || role === "ssvip") {
        continue;
      }

      labels.push(roleLabelByKey(role));
    }

    return labels.length > 0 ? labels.join(", ") : t("article.visibilitySelected");
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

  function updateActivePublishedAt(value: string): void {
    setPublishedAtByLocale((currentPublishedAt) => ({
      ...currentPublishedAt,
      [activeLocale]: value
    }));
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

    setIsSavingConfig(true);
    setModalErrorMessage(null);
    setModalSuccessMessage(null);

    try {
      const parsedCoverAttachmentId = parseCoverAttachmentId();
      const articleResponse = await articleApi.updateArticle(editingArticle.article.id, {
        coverAttachmentId: parsedCoverAttachmentId
      });
      const translationResponse = activeTranslation
        ? await articleApi.updateTranslation(editingArticle.article.id, activeLocale, {
            allowedRoles: editableVisibleRoles(allowedRoles[activeLocale] ?? []),
            publishedAt: activeTranslation.publishedVersionId !== null
              ? dateTimeLocalToIso(publishedAtByLocale[activeLocale] ?? "")
              : undefined
          })
        : null;

      const nextDetail = {
        article: articleResponse.article,
        translations: translationResponse
          ? editingArticle.translations.map((translation) => (
              translation.locale === translationResponse.translation.locale ? translationResponse.translation : translation
            ))
          : editingArticle.translations
      };
      const nextState = buildTranslationState(nextDetail);

      setArticles((currentArticles) => replaceArticleDetail(currentArticles, nextDetail));
      setEditingArticle(nextDetail);
      setExistingTranslations(nextState.existingTranslations);
      setAllowedRoles(nextState.visibility);
      setPublishedAtByLocale(nextState.publishedAt);
      setCoverAttachmentId(nextDetail.article.coverAttachmentId === null ? "" : String(nextDetail.article.coverAttachmentId));
      setModalSuccessMessage(t("article.configSaved"));
    } catch (error) {
      setModalErrorMessage(error instanceof Error ? error.message : t("article.configSaveFailed"));
    } finally {
      setIsSavingConfig(false);
    }
  }

  function applyUpdatedTranslation(translation: ArticleTranslation, successMessage: string): void {
    if (!editingArticle) {
      return;
    }

    const nextTranslations = editingArticle.translations.some((item) => item.locale === translation.locale)
      ? editingArticle.translations.map((item) => (item.locale === translation.locale ? translation : item))
      : [...editingArticle.translations, translation];
    const nextDetail = {
      article: editingArticle.article,
      translations: nextTranslations
    };
    const nextState = buildTranslationState(nextDetail);

    setArticles((currentArticles) => replaceArticleDetail(currentArticles, nextDetail));
    setEditingArticle(nextDetail);
    setExistingTranslations(nextState.existingTranslations);
    setAllowedRoles(nextState.visibility);
    setPublishedAtByLocale(nextState.publishedAt);
    setModalSuccessMessage(successMessage);
  }

  async function handlePublishActiveTranslation(): Promise<void> {
    if (!editingArticle || !activeTranslation) {
      setModalErrorMessage(t("article.markdownNeedsMetadata"));
      setModalSuccessMessage(null);
      return;
    }

    if (activeTranslation.currentVersionId === null) {
      setModalErrorMessage(t("article.noCurrentVersion"));
      setModalSuccessMessage(null);
      return;
    }

    setIsPublishingConfig(true);
    setModalErrorMessage(null);
    setModalSuccessMessage(null);

    try {
      const response = await versionApi.publishVersion(editingArticle.article.id, activeLocale, activeTranslation.currentVersionId, {
        allowedRoles: editableVisibleRoles(allowedRoles[activeLocale] ?? [])
      });

      applyUpdatedTranslation(response.translation, t("article.publishSuccess"));
    } catch (error) {
      setModalErrorMessage(error instanceof Error ? error.message : t("article.publishFailed"));
    } finally {
      setIsPublishingConfig(false);
    }
  }

  async function handleUnpublishActiveTranslation(): Promise<void> {
    if (!editingArticle || !activeTranslation) {
      setModalErrorMessage(t("article.markdownNeedsMetadata"));
      setModalSuccessMessage(null);
      return;
    }

    setIsUnpublishingConfig(true);
    setModalErrorMessage(null);
    setModalSuccessMessage(null);

    try {
      const response = await versionApi.unpublishVersion(editingArticle.article.id, activeLocale);

      applyUpdatedTranslation(response.translation, t("article.unpublishSuccess"));
    } catch (error) {
      setModalErrorMessage(error instanceof Error ? error.message : t("article.unpublishFailed"));
    } finally {
      setIsUnpublishingConfig(false);
    }
  }

  async function handleDeleteArticle(): Promise<void> {
    if (!editingArticle || !canDeleteArticle) {
      return;
    }

    const title = editingArticleTitle ?? t("article.untitledDraft").replace("{id}", String(editingArticle.article.id));
    const confirmMessage = t("article.deleteConfirm").replace("{title}", title);

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsDeletingArticle(true);
    setModalErrorMessage(null);
    setModalSuccessMessage(null);

    try {
      await articleApi.deleteArticle(editingArticle.article.id);
      setArticles((currentArticles) => currentArticles.filter((item) => item.article.id !== editingArticle.article.id));
      setEditingArticle(null);
      setUploadedCoverAttachment(null);
    } catch (error) {
      setModalErrorMessage(error instanceof Error ? error.message : t("article.deleteFailed"));
    } finally {
      setIsDeletingArticle(false);
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
            <AdminLoadingSkeleton label={t("article.listLoading")} rows={5} variant="table" />
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
                  <th>{t("article.visibilityColumn")}</th>
                  <th>{t("article.publishedAt")}</th>
                  <th>{t("article.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((item) => {
                  const titleTranslation = preferredTranslation(item.translations);
                  const itemPublishState = articlePublishState(item);
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
                    <td className="admin-article-status-cell">
                      <span className="admin-status-badge" data-status={itemPublishState}>
                        {t(`article.publishState.${itemPublishState}`)}
                      </span>
                    </td>
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
                    <td>
                      <div className="admin-article-visibility-list">
                        {articleLocales.map((locale) => {
                          const translation = findTranslation(item.translations, locale);

                          return (
                            <span className="admin-article-visibility-chip" key={locale}>
                              <span>{locale}</span>
                              <strong>{visibilityLabel(translation?.allowedRoles ?? [])}</strong>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="admin-article-updated-cell">{formatDate(preferredPublishedTranslation(item.translations)?.publishedAt, formatterLocale)}</td>
                    <td>
                      {canEditArticle ? (
                        <div className="admin-article-actions">
                          <a
                            className="liax-button liax-button--primary"
                            href={`#articles/${item.article.id}/${preferredEditLocale(item.translations)}/content`}
                          >
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
        <div className="admin-modal-backdrop" onMouseDown={closeConfigModalFromBackdrop} role="presentation">
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
                <p className="admin-modal__subtitle">{t("article.configHelp")}</p>
              </div>
              <button className="liax-button" disabled={isConfigBusy} onClick={closeConfigModal} type="button">
                {t("article.cancel")}
              </button>
            </header>

            <div className="admin-modal__body">
              <div className="admin-article-config-summary">
                <span>{t("article.id")} {editingArticle.article.id}</span>
                <span>{t("article.status")}: {t(`article.publishState.${articlePublishState(editingArticle)}`)}</span>
                <span>{activeLocale}: {t(`article.translation.${translationStatus(activeTranslation)}`)}</span>
                <span>{t("article.visibilityColumn")}: {visibilityLabel(allowedRoles[activeLocale] ?? [])}</span>
              </div>

              <div className="admin-article-config-layout">
              <section className="admin-article-config-section admin-article-config-section--basic">
                <h4>{t("article.basicConfig")}</h4>
                <div className="admin-article-config-grid">
                  <div className="admin-form-field admin-publish-config">
                    <span>{t("article.publishConfigTitle")}</span>
                    <span className="admin-status-badge" data-status={activePublishState}>
                      {t(`article.publishState.${activePublishState}`)}
                    </span>
                    <small>{t("article.statusHelp")}</small>
                    <div className="admin-publish-config__actions">
                      <button
                        className="liax-button liax-button--primary"
                        disabled={isConfigBusy || !canPublishArticle || !activeTranslation || activeTranslation.currentVersionId === null}
                        onClick={() => void handlePublishActiveTranslation()}
                        type="button"
                      >
                        {isPublishingConfig ? t("article.publishing") : t("article.publishCurrent")}
                      </button>
                      <button
                        className="liax-button"
                        disabled={isConfigBusy || !canPublishArticle || !activeTranslation || activeTranslation.publishedVersionId === null}
                        onClick={() => void handleUnpublishActiveTranslation()}
                        type="button"
                      >
                        {isUnpublishingConfig ? t("article.unpublishing") : t("article.unpublishCurrent")}
                      </button>
                    </div>
                  </div>

                  <label className="admin-form-field">
                    <span>{t("article.publishedAt")}</span>
                    <input
                      disabled={isConfigBusy || activeTranslation?.publishedVersionId === null || !activeTranslation}
                      onChange={(event) => updateActivePublishedAt(event.target.value)}
                      type="datetime-local"
                      value={publishedAtByLocale[activeLocale] ?? ""}
                    />
                    <small>
                      {activeTranslation?.publishedVersionId !== null && activeTranslation
                        ? t("article.publishedAtHelp")
                        : t("article.publishedAtUnavailable")}
                    </small>
                  </label>

                  <div className="admin-cover-upload-panel">
                    <label className="admin-form-field">
                      <span>{t("article.coverImage")}</span>
                      <input
                        accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                        disabled={isConfigBusy}
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
                          disabled={isConfigBusy}
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

              <section className="admin-article-config-section admin-article-config-section--visibility">
                <div className="admin-article-config-section__header">
                  <h4>{t("article.visibilityTitle")}</h4>
                  <LocaleTabs activeLocale={activeLocale} onChange={setActiveLocale} />
                </div>
                <p className="admin-article-visibility-summary">
                  <span>{activeLocale}</span>
                  <strong>{visibilityLabel(allowedRoles[activeLocale] ?? [])}</strong>
                </p>
                <p className="admin-muted-text admin-article-config-help">{t("article.visibilityHelp")}</p>
                <div className="admin-role-checkbox-grid admin-role-checkbox-grid--compact">
                  {roleOptions.map((role) => (
                    <label className="admin-role-checkbox" key={role.roleKey}>
                      <input
                        checked={(allowedRoles[activeLocale] ?? []).includes(role.roleKey)}
                        disabled={isConfigBusy || !activeTranslation}
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

              {canDeleteArticle ? (
                <section className="admin-article-config-section admin-article-config-section--danger">
                  <h4>{t("article.deleteTitle")}</h4>
                  <p className="admin-muted-text admin-article-config-help">{t("article.deleteHelp")}</p>
                  <button
                    className="liax-button liax-button--danger"
                    disabled={isConfigBusy}
                    onClick={() => void handleDeleteArticle()}
                    type="button"
                  >
                    {isDeletingArticle ? t("article.deleting") : t("article.deleteAction")}
                  </button>
                </section>
              ) : null}
              </div>

              <div className="admin-form-actions">
                <button
                  className="liax-button liax-button--primary"
                  disabled={isConfigBusy}
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
