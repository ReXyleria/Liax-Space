import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";

import { articleApi, type ArticleLocale, type ArticleTranslation } from "../api/articleApi";
import { attachmentApi } from "../api/attachmentApi";
import { ApiError } from "../api/httpClient";
import { translationApi } from "../api/translationApi";
import { type ArticleVersionSummary, versionApi } from "../api/versionApi";
import {
  extractHeadingsFromMarkdown,
  largeMarkdownDocumentThreshold,
  MarkdownEditor,
  shouldUsePlainMarkdownEditor,
  type EditorHeading
} from "../components/MarkdownEditor";
import { AdminLayout } from "../layout/AdminLayout";
import { useT } from "../i18n/useT";

export type ArticleMarkdownEditPageProps = {
  articleId: number;
  locale: ArticleLocale;
};

function findTranslation(translations: ArticleTranslation[], locale: ArticleLocale): ArticleTranslation | null {
  return translations.find((translation) => translation.locale === locale) ?? null;
}

function isVersionConflict(error: unknown): boolean {
  return error instanceof ApiError && error.code === "ARTICLE_VERSION_CONFLICT";
}

function oppositeLocale(locale: ArticleLocale): ArticleLocale {
  return locale === "zh-CN" ? "en-US" : "zh-CN";
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

export function ArticleMarkdownEditPage({ articleId, locale }: ArticleMarkdownEditPageProps): ReactElement {
  const t = useT();
  const [translation, setTranslation] = useState<ArticleTranslation | null>(null);
  const [baseVersionId, setBaseVersionId] = useState<number | null>(null);
  const [mdContent, setMdContent] = useState("");
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [importedVersionSummary, setImportedVersionSummary] = useState<ArticleVersionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastSavedContentRef = useRef("");
  const mdContentRef = useRef("");
  const autoSaveTimerRef = useRef<number | null>(null);
  const suppressNextAutoSaveRef = useRef(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceLocale = oppositeLocale(locale);
  const pageTitle = useMemo(() => `${t("article.markdownTitle")} #${articleId} - ${locale}`, [articleId, locale, t]);
  const headings = useMemo(() => shouldUsePlainMarkdownEditor(mdContent) ? [] : extractHeadingsFromMarkdown(mdContent), [mdContent]);
  const isEditorLockedByImport = importedVersionSummary !== null;

  useEffect(() => {
    let isMounted = true;

    async function loadInitialContent(): Promise<void> {
      setIsLoading(true);
      setMessage(null);
      setErrorMessage(null);

      try {
        const articleDetail = await articleApi.getArticle(articleId);
        const activeTranslation = findTranslation(articleDetail.translations, locale);
        const versionsResponse = activeTranslation
          ? await versionApi.listVersionSummaries(articleId, locale)
          : { versions: [] };
        const latestVersion = versionsResponse.versions[0] ?? null;
        const shouldLoadLatestContent = latestVersion
          ? (latestVersion.contentSizeBytes ?? 0) < largeMarkdownDocumentThreshold
          : false;
        const fullVersion = latestVersion && shouldLoadLatestContent
          ? (await versionApi.getVersion(articleId, locale, latestVersion.id)).version
          : null;
        const nextMarkdown = fullVersion?.mdContent ?? "";

        if (isMounted) {
          setTranslation(activeTranslation);
          setBaseVersionId(latestVersion?.id ?? null);
          setImportedVersionSummary(latestVersion && !shouldLoadLatestContent ? latestVersion as ArticleVersionSummary : null);
          setMdContent(nextMarkdown);
          mdContentRef.current = nextMarkdown;
          lastSavedContentRef.current = nextMarkdown;
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : t("article.markdownLoadFailed"));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialContent();

    return () => {
      isMounted = false;
    };
  }, [articleId, locale, t]);

  useEffect(() => {
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (
      isEditorLockedByImport ||
      isLoading ||
      isSaving ||
      isAutoSaving ||
      !translation ||
      mdContent === lastSavedContentRef.current ||
      suppressNextAutoSaveRef.current
    ) {
      return;
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      void saveContent({ auto: true });
    }, 2000);

    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [baseVersionId, isAutoSaving, isEditorLockedByImport, isLoading, isSaving, mdContent, translation]);

  async function saveContent(options: { auto: boolean }): Promise<void> {
    if (!translation) {
      setErrorMessage(t("article.markdownNeedsMetadata"));
      return;
    }

    if (options.auto) {
      setIsAutoSaving(true);
    } else {
      setIsSaving(true);
      setMessage(null);
    }

    setErrorMessage(null);

    try {
      const response = await versionApi.saveVersion(articleId, locale, {
        baseVersionId,
        mdContent: mdContentRef.current
      });

      setBaseVersionId(response.version.id);
      const savedMarkdown = response.version.mdContent ?? mdContentRef.current;

      setMdContent(savedMarkdown);
      mdContentRef.current = savedMarkdown;
      lastSavedContentRef.current = savedMarkdown;
      setMessage(options.auto
        ? t("article.autoSaved")
        : response.unchanged ? t("article.markdownUnchanged") : t("article.markdownSaved"));
    } catch (error) {
      setErrorMessage(
        isVersionConflict(error)
          ? t("article.versionConflict")
          : error instanceof Error ? error.message : t("article.markdownSaveFailed")
      );
    } finally {
      if (options.auto) {
        setIsAutoSaving(false);
      } else {
        setIsSaving(false);
      }
    }
  }

  async function handleSave(): Promise<void> {
    if (isEditorLockedByImport) {
      setErrorMessage(t("article.importEditorLocked"));
      return;
    }

    await saveContent({ auto: false });
  }

  function handleEditorChange(value: string): void {
    suppressNextAutoSaveRef.current = false;
    setImportedVersionSummary(null);
    mdContentRef.current = value;
    setMdContent(value);
  }

  function handleHeadingJump(heading: EditorHeading): void {
    const headingElements = Array.from(
      document.querySelectorAll<HTMLElement>(".admin-visual-editor__surface h1, .admin-visual-editor__surface h2, .admin-visual-editor__surface h3, .admin-visual-editor__surface h4, .admin-visual-editor__surface h5, .admin-visual-editor__surface h6")
    );
    const target = headingElements.find((element) => element.dataset.editorHeadingId === heading.id)
      ?? headingElements.find((element) => element.textContent?.replace(/\s+/g, " ").trim() === heading.text);

    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.classList.add("admin-editor-heading--focused");
    window.setTimeout(() => target.classList.remove("admin-editor-heading--focused"), 900);
  }

  async function handleTranslateContent(): Promise<void> {
    if (isEditorLockedByImport) {
      setErrorMessage(t("article.importEditorLocked"));
      return;
    }

    setIsTranslating(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const versionsResponse = await versionApi.listVersions(articleId, sourceLocale);
      const latestSourceVersion = versionsResponse.versions[0] ?? null;
      const latestSourceMarkdown = latestSourceVersion?.mdContent ?? "";

      if (!latestSourceVersion || !latestSourceMarkdown.trim()) {
        setErrorMessage(t("article.translateSourceMissing"));
        return;
      }

      const response = await translationApi.translate({
        fields: {
          content: latestSourceMarkdown
        },
        sourceLocale,
        targetLocale: locale
      });

      suppressNextAutoSaveRef.current = true;
      mdContentRef.current = response.translation.fields.content ?? "";
      setMdContent(response.translation.fields.content ?? "");
      setMessage(t("article.translateReady"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("article.translateFailed"));
    } finally {
      setIsTranslating(false);
    }
  }

  async function handlePasteImage(file: File): Promise<{ markdown: string; previewUrl: string }> {
    setMessage(null);
    setErrorMessage(null);

    try {
      const result = await attachmentApi.uploadAttachment(file);
      setMessage(t("attachment.pasted"));
      return {
        markdown: result.markdown,
        previewUrl: result.attachment.publicUrl ?? result.markdown
      };
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("attachment.uploadFailed"));
      throw error;
    }
  }

  async function handleImportMarkdownFile(): Promise<void> {
    if (!translation) {
      setErrorMessage(t("article.markdownNeedsMetadata"));
      return;
    }

    if (!selectedImportFile) {
      setErrorMessage(t("article.importFileRequired"));
      return;
    }

    setIsImporting(true);
    setImportProgress(0);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await versionApi.importMarkdownFile(articleId, locale, selectedImportFile, setImportProgress);

      suppressNextAutoSaveRef.current = true;
      setBaseVersionId(response.version.id);
      setImportedVersionSummary(response.version);
      setSelectedImportFile(null);
      setMessage(
        response.unchanged
          ? t("article.importUnchanged")
          : t("article.importSaved")
      );

      if (importFileInputRef.current) {
        importFileInputRef.current.value = "";
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("article.importFailed"));
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  }

  return (
    <AdminLayout>
      <section className="admin-page-header">
        <div>
          <p className="admin-kicker">{t("article.markdownKicker")}</p>
          <h2>{pageTitle}</h2>
        </div>
        <div className="admin-page-actions">
          <a className="liax-link" href={`#articles/${articleId}/edit`}>
            {t("article.backToMetadata")}
          </a>
          <a className="liax-link" href={`#articles/${articleId}/${locale}/versions`}>
            {t("article.versions")}
          </a>
        </div>
      </section>

      <section className="admin-markdown-workspace">
        <article className="liax-card admin-markdown-panel">
          <div className="liax-card__header">
            <div className="admin-metadata-context">
              <span>{t("article.field.title")}: {translation?.title ?? t("article.translation.missing")}</span>
              <span>{t("article.baseVersion")}: {baseVersionId ?? t("article.noVersion")}</span>
            </div>
          </div>
          <div className="liax-card__body">
            {isLoading ? (
              <p className="admin-muted-text">{t("article.markdownLoading")}</p>
            ) : (
              <>
                {!translation ? (
                  <p className="admin-error-text">{t("article.markdownNeedsMetadata")}</p>
                ) : null}

                <MarkdownEditor
                  disabled={isSaving || isTranslating || isImporting || isEditorLockedByImport}
                  onChange={handleEditorChange}
                  onDraftChange={(value) => {
                    suppressNextAutoSaveRef.current = false;
                    setImportedVersionSummary(null);
                    mdContentRef.current = value;
                  }}
                  onUploadImage={handlePasteImage}
                  value={mdContent}
                />

                <section className="admin-markdown-import" aria-label={t("article.importTitle")}>
                  <div>
                    <h3>{t("article.importTitle")}</h3>
                    <p>{t("article.importHelp")}</p>
                  </div>
                  <label className="admin-form-field admin-markdown-import__file">
                    <span>{t("article.importFile")}</span>
                    <input
                      accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain"
                      disabled={isImporting || !translation}
                      onChange={(event) => setSelectedImportFile(event.target.files?.[0] ?? null)}
                      ref={importFileInputRef}
                      type="file"
                    />
                  </label>
                  <button
                    className="liax-button"
                    disabled={isImporting || !selectedImportFile || !translation}
                    onClick={() => void handleImportMarkdownFile()}
                    type="button"
                  >
                    {isImporting ? t("article.importing") : t("article.importAction")}
                  </button>
                  {selectedImportFile ? (
                    <p className="admin-muted-text">{selectedImportFile.name} · {formatBytes(selectedImportFile.size)}</p>
                  ) : null}
                  {typeof importProgress === "number" ? (
                    <div className="admin-markdown-import__progress" aria-label={t("article.importProgress")}>
                      <span style={{ width: `${importProgress}%` }} />
                    </div>
                  ) : null}
                  {importedVersionSummary ? (
                    <p className="admin-success-text">
                      {t("article.importLoadedSummary")} {t("article.versionNo")} {importedVersionSummary.versionNo} · {formatBytes(importedVersionSummary.contentSizeBytes)}
                    </p>
                  ) : null}
                </section>

                <div className="admin-form-actions">
                  <button
                    className="liax-button"
                    disabled={isTranslating || isEditorLockedByImport}
                    onClick={() => void handleTranslateContent()}
                    type="button"
                  >
                    {isTranslating ? t("article.translating") : `${t("article.translateFrom")} ${sourceLocale}`}
                  </button>
                  <button
                    className="liax-button liax-button--primary"
                    disabled={isSaving || !translation || isEditorLockedByImport}
                    onClick={() => void handleSave()}
                    type="button"
                  >
                    {isSaving ? t("article.markdownSaving") : t("article.markdownSave")}
                  </button>
                </div>

                {isAutoSaving ? <p className="admin-muted-text">{t("article.autoSaving")}</p> : null}
                {message ? <p className="admin-success-text">{message}</p> : null}
                {errorMessage ? <p className="admin-error-text">{errorMessage}</p> : null}
              </>
            )}
          </div>
        </article>

        <aside className="liax-card admin-editor-toc-panel" aria-label={t("article.editorToc")}>
          <div className="liax-card__header">
            <h3>{t("article.editorToc")}</h3>
          </div>
          <div className="liax-card__body">
            {headings.length === 0 ? (
              <p className="admin-editor-toc-panel__empty">{t("article.editorTocEmpty")}</p>
            ) : (
              <nav className="admin-editor-toc-panel__list" aria-label={t("article.editorToc")}>
                {headings.map((heading) => (
                  <button
                    className={`admin-editor-toc-panel__item admin-editor-toc-panel__item--level-${heading.level}`}
                    key={heading.id}
                    onClick={() => handleHeadingJump(heading)}
                    type="button"
                  >
                    {heading.text}
                  </button>
                ))}
              </nav>
            )}
          </div>
        </aside>
      </section>
    </AdminLayout>
  );
}
