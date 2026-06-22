import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";

import { articleApi, type ArticleLocale, type ArticleTranslation } from "../api/articleApi";
import { type ArticleVersion, versionApi } from "../api/versionApi";
import { largeMarkdownDocumentThreshold } from "../components/MarkdownEditor";
import { VisualContentView } from "../components/VisualContentView";
import { VersionList } from "../components/VersionList";
import { useT } from "../i18n/useT";
import { AdminLayout } from "../layout/AdminLayout";

export type ArticleVersionsPageProps = {
  articleId: number;
  locale: ArticleLocale;
};

function findTranslation(translations: ArticleTranslation[], locale: ArticleLocale): ArticleTranslation | null {
  return translations.find((translation) => translation.locale === locale) ?? null;
}

function sortVersions(versions: ArticleVersion[]): ArticleVersion[] {
  return [...versions].sort((left, right) => right.versionNo - left.versionNo);
}

function replaceVersion(versions: ArticleVersion[], nextVersion: ArticleVersion): ArticleVersion[] {
  const exists = versions.some((version) => version.id === nextVersion.id);
  const nextVersions = exists
    ? versions.map((version) => version.id === nextVersion.id ? nextVersion : version)
    : [nextVersion, ...versions];

  return sortVersions(nextVersions);
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

export function ArticleVersionsPage({ articleId, locale }: ArticleVersionsPageProps): ReactElement {
  const t = useT();
  const [versions, setVersions] = useState<ArticleVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<ArticleVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pageTitle = useMemo(() => `${t("article.versionsTitle")} #${articleId} - ${locale}`, [articleId, locale, t]);

  const loadVersions = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const [articleDetail, versionsResponse] = await Promise.all([
        articleApi.getArticle(articleId),
        versionApi.listVersionSummaries(articleId, locale)
      ]);
      const activeTranslation = findTranslation(articleDetail.translations, locale);
      const sortedVersions = sortVersions(versionsResponse.versions);
      const preferredVersion =
        sortedVersions.find((version) => version.id === activeTranslation?.currentVersionId) ?? sortedVersions[0] ?? null;

      setVersions(sortedVersions);
      setSelectedVersion(preferredVersion);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("article.versionsLoadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [articleId, locale, t]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  async function handleSelectVersion(version: ArticleVersion): Promise<void> {
    if (version.mdContent !== undefined) {
      setSelectedVersion(version);
      return;
    }

    setSelectedVersion(version);
    setIsBusy(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      if ((version.contentSizeBytes ?? 0) >= largeMarkdownDocumentThreshold) {
        setMessage(t("article.largeVersionPreviewSkipped"));
        const markdown = await versionApi.getVersionMarkdown(articleId, locale, version.id, {
          onProgress: ({ content }) => {
            setSelectedVersion({ ...version, mdContent: content });
          }
        });
        const loadedVersion = { ...version, mdContent: markdown };

        setSelectedVersion(loadedVersion);
        setVersions((currentVersions) => replaceVersion(currentVersions, loadedVersion));
      } else {
        const response = await versionApi.getVersion(articleId, locale, version.id);
        setSelectedVersion(response.version);
        setVersions((currentVersions) => replaceVersion(currentVersions, response.version));
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("article.versionLoadFailed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRollback(version: ArticleVersion): Promise<void> {
    setIsBusy(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await versionApi.rollbackVersion(articleId, locale, version.id);
      setSelectedVersion(response.version);
      setVersions((currentVersions) => replaceVersion(currentVersions, response.version));
      setMessage(t("article.rollbackSuccess"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("article.rollbackFailed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleTogglePin(version: ArticleVersion): Promise<void> {
    setIsBusy(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = version.isPinned
        ? await versionApi.unpinVersion(articleId, locale, version.id)
        : await versionApi.pinVersion(articleId, locale, version.id);

      setSelectedVersion((currentVersion) => currentVersion?.id === response.version.id ? response.version : currentVersion);
      setVersions((currentVersions) => replaceVersion(currentVersions, response.version));
      setMessage(t("article.pinUpdated"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("article.pinFailed"));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <AdminLayout>
      <section className="admin-page-header">
        <div>
          <p className="admin-kicker">{t("article.versionsKicker")}</p>
          <h2>{pageTitle}</h2>
        </div>
        <div className="admin-page-actions">
          <a className="liax-link" href={`#articles/${articleId}/edit`}>
            {t("article.backToMetadata")}
          </a>
          <a className="liax-link" href={`#articles/${articleId}/${locale}/content`}>
            {t("article.backToMarkdown")}
          </a>
        </div>
      </section>

      {isLoading ? (
        <p className="admin-muted-text">{t("article.versionsLoading")}</p>
      ) : (
        <section className="admin-version-workspace">
          <div className="admin-version-sidebar">
            <VersionList
              isBusy={isBusy}
              onRollback={(version) => void handleRollback(version)}
              onSelect={(version) => void handleSelectVersion(version)}
              onTogglePin={(version) => void handleTogglePin(version)}
              selectedVersionId={selectedVersion?.id ?? null}
              versions={versions}
            />
          </div>

          <article className="liax-card admin-selected-version">
            <div className="liax-card__header">
              <div>
                <p className="admin-kicker">{t("article.selectedMarkdown")}</p>
                <h3>
                  {selectedVersion
                    ? `${t("article.versionNo")} ${selectedVersion.versionNo}`
                    : t("article.noVersion")}
                </h3>
              </div>
            </div>
            <div className="liax-card__body">
              {selectedVersion && selectedVersion.mdContent !== undefined ? (
                <VisualContentView value={selectedVersion.mdContent} />
              ) : selectedVersion ? (
                <div className="admin-version-content-placeholder">
                  <p className="admin-muted-text">
                    {t("article.versionContentNotLoaded")}
                  </p>
                  {selectedVersion.contentSizeBytes !== undefined ? (
                    <p className="admin-muted-text">
                      {t("article.versionSize")}: {formatBytes(selectedVersion.contentSizeBytes)}
                    </p>
                  ) : null}
                  <button className="liax-button" disabled={isBusy} onClick={() => void handleSelectVersion(selectedVersion)} type="button">
                    {t("article.loadVersionPreview")}
                  </button>
                </div>
              ) : (
                <p className="admin-muted-text">{t("article.noVersions")}</p>
              )}
            </div>
          </article>
        </section>
      )}

      {message ? <p className="admin-success-text">{message}</p> : null}
      {errorMessage ? <p className="admin-error-text">{errorMessage}</p> : null}
    </AdminLayout>
  );
}
