import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactElement } from "react";

import { articleApi, type ArticleLocale, type ArticleTranslation } from "../api/articleApi";
import { attachmentApi } from "../api/attachmentApi";
import { ApiError } from "../api/httpClient";
import { translationApi } from "../api/translationApi";
import { versionApi } from "../api/versionApi";
import {
  extractHeadingsFromMarkdown,
  largeMarkdownDocumentThreshold,
  MarkdownEditor,
  type EditorHeading
} from "../components/MarkdownEditor";
import { AdminLayout } from "../layout/AdminLayout";
import { useT } from "../i18n/useT";
import { loadAttachmentPreviewUrlsForMarkdown } from "../utils/attachmentPreviewUrls";

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
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [translation, setTranslation] = useState<ArticleTranslation | null>(null);
  const [baseVersionId, setBaseVersionId] = useState<number | null>(null);
  const [mdContent, setMdContent] = useState("");
  const [attachmentPreviewUrls, setAttachmentPreviewUrls] = useState<Record<string, string>>({});
  const [selectedImportFile, setSelectedImportFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydratingContent, setIsHydratingContent] = useState(false);
  const [forcePlainEditor, setForcePlainEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isImportingMarkdown, setIsImportingMarkdown] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastSavedContentRef = useRef("");
  const mdContentRef = useRef("");
  const isHydratingContentRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const suppressNextAutoSaveRef = useRef(false);
  const sourceLocale = oppositeLocale(locale);
  const pageTitle = useMemo(() => `${t("article.markdownTitle")} #${articleId} - ${locale}`, [articleId, locale, t]);
  const headings = useMemo(() => extractHeadingsFromMarkdown(mdContent), [mdContent]);

  function setHydratingContent(nextValue: boolean): void {
    isHydratingContentRef.current = nextValue;
    setIsHydratingContent(nextValue);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialContent(): Promise<void> {
      setIsLoading(true);
      setHydratingContent(false);
      setForcePlainEditor(false);
      setSelectedImportFile(null);
      setImportProgress(null);
      setIsImportingMarkdown(false);
      setMessage(null);
      setErrorMessage(null);

      if (importFileInputRef.current) {
        importFileInputRef.current.value = "";
      }

      try {
        const articleDetail = await articleApi.getArticle(articleId);
        const activeTranslation = findTranslation(articleDetail.translations, locale);
        const versionsResponse = activeTranslation
          ? await versionApi.listVersionSummaries(articleId, locale)
          : { versions: [] };
        const latestVersion = versionsResponse.versions[0] ?? null;
        const shouldForcePlainEditor = Boolean(
          latestVersion && (latestVersion.contentSizeBytes ?? 0) >= largeMarkdownDocumentThreshold
        );

        if (isMounted) {
          setTranslation(activeTranslation);
          setBaseVersionId(latestVersion?.id ?? null);
          setForcePlainEditor(shouldForcePlainEditor);
        }

        const nextMarkdown = latestVersion
          ? await versionApi.getVersionMarkdown(articleId, locale, latestVersion.id, {
              onProgress: ({ content, done }) => {
                if (!isMounted || !shouldForcePlainEditor) {
                  return;
                }

                mdContentRef.current = content;
                lastSavedContentRef.current = content;
                setMdContent(content);
                setHydratingContent(!done);
                setIsLoading(false);
              }
            })
          : "";

        const nextAttachmentPreviewUrls = await loadAttachmentPreviewUrlsForMarkdown(
          nextMarkdown,
          attachmentApi.listAttachments
        ).catch(() => ({}));

        if (isMounted) {
          setTranslation(activeTranslation);
          setBaseVersionId(latestVersion?.id ?? null);
          setForcePlainEditor(shouldForcePlainEditor);
          setAttachmentPreviewUrls(nextAttachmentPreviewUrls);
          setMdContent(nextMarkdown);
          mdContentRef.current = nextMarkdown;
          lastSavedContentRef.current = nextMarkdown;
          setHydratingContent(false);
        }
      } catch (error) {
        if (isMounted) {
          setHydratingContent(false);
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
      isLoading ||
      isHydratingContent ||
      isImportingMarkdown ||
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
  }, [baseVersionId, isAutoSaving, isHydratingContent, isImportingMarkdown, isLoading, isSaving, mdContent, translation]);

  async function saveContent(options: { auto: boolean }): Promise<void> {
    if (isHydratingContentRef.current) {
      setErrorMessage(t("article.markdownLoading"));
      return;
    }

    if (isImportingMarkdown) {
      setErrorMessage(t("article.importing"));
      return;
    }

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
    await saveContent({ auto: false });
  }

  function openImportFilePicker(): void {
    if (isHydratingContent || isImportingMarkdown || !translation) {
      return;
    }

    importFileInputRef.current?.click();
  }

  async function handleImportFileSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!translation) {
      setErrorMessage(t("article.markdownNeedsMetadata"));
      setMessage(null);
      input.value = "";
      return;
    }

    setSelectedImportFile(file);
    setIsImportingMarkdown(true);
    setImportProgress(0);
    setHydratingContent(false);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await versionApi.importMarkdownFile(articleId, locale, file, setImportProgress);
      const shouldForcePlainEditor = response.version.contentSizeBytes >= largeMarkdownDocumentThreshold;

      setForcePlainEditor(shouldForcePlainEditor);
      setHydratingContent(true);

      const importedMarkdown = await versionApi.getVersionMarkdown(articleId, locale, response.version.id, {
        onProgress: ({ content, done }) => {
          if (!shouldForcePlainEditor) {
            return;
          }

          mdContentRef.current = content;
          lastSavedContentRef.current = content;
          setMdContent(content);
          setHydratingContent(!done);
        }
      });
      const nextAttachmentPreviewUrls = await loadAttachmentPreviewUrlsForMarkdown(
        importedMarkdown,
        attachmentApi.listAttachments
      ).catch(() => ({}));

      suppressNextAutoSaveRef.current = true;
      setBaseVersionId(response.version.id);
      setAttachmentPreviewUrls(nextAttachmentPreviewUrls);
      setMdContent(importedMarkdown);
      mdContentRef.current = importedMarkdown;
      lastSavedContentRef.current = importedMarkdown;
      setSelectedImportFile(null);
      setMessage(
        `${response.unchanged ? t("article.importUnchanged") : t("article.importSaved")} ${t("article.versionNo")} ${response.version.versionNo} · ${formatBytes(response.version.contentSizeBytes)}`
      );

    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("article.importFailed"));
    } finally {
      setHydratingContent(false);
      setIsImportingMarkdown(false);
      setImportProgress(null);
      input.value = "";
    }
  }

  function handleEditorChange(value: string): void {
    suppressNextAutoSaveRef.current = false;
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
    setIsTranslating(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const versionsResponse = await versionApi.listVersionSummaries(articleId, sourceLocale);
      const latestSourceVersion = versionsResponse.versions[0] ?? null;
      const latestSourceMarkdown = latestSourceVersion
        ? await versionApi.getVersionMarkdown(articleId, sourceLocale, latestSourceVersion.id)
        : "";

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
      const previewUrl = result.attachment.publicUrl ?? result.markdown;

      if (result.attachment.publicUrl) {
        setAttachmentPreviewUrls((currentPreviewUrls) => ({
          ...currentPreviewUrls,
          [String(result.attachment.id)]: result.attachment.publicUrl ?? previewUrl,
          [`attachment://${result.attachment.id}`]: result.attachment.publicUrl ?? previewUrl
        }));
      }

      setMessage(t("attachment.pasted"));
      return {
        markdown: result.markdown,
        previewUrl
      };
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("attachment.uploadFailed"));
      throw error;
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

                <div className="admin-markdown-import admin-markdown-import--editor">
                  <input
                    accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain"
                    className="admin-markdown-import__input"
                    disabled={isHydratingContent || isImportingMarkdown || !translation}
                    onChange={(event) => void handleImportFileSelected(event)}
                    ref={importFileInputRef}
                    type="file"
                  />
                  <button
                    className="liax-button liax-button--primary"
                    disabled={isHydratingContent || isImportingMarkdown || !translation}
                    onClick={openImportFilePicker}
                    type="button"
                  >
                    {isImportingMarkdown ? t("article.importing") : t("article.importAction")}
                  </button>
                  {selectedImportFile ? (
                    <p className="admin-muted-text admin-markdown-import__selection">
                      {selectedImportFile.name} · {formatBytes(selectedImportFile.size)}
                    </p>
                  ) : (
                    <p className="admin-muted-text admin-markdown-import__selection">{t("article.importHelp")}</p>
                  )}
                  {typeof importProgress === "number" ? (
                    <div className="admin-markdown-import__progress" aria-label={t("article.importProgress")}>
                      <span style={{ width: `${importProgress}%` }} />
                    </div>
                  ) : null}
                </div>

                <MarkdownEditor
                  attachmentPreviewUrls={attachmentPreviewUrls}
                  disabled={isSaving || isTranslating || isHydratingContent || isImportingMarkdown}
                  forcePlainTextMode={forcePlainEditor}
                  onChange={handleEditorChange}
                  onDraftChange={(value) => {
                    suppressNextAutoSaveRef.current = false;
                    mdContentRef.current = value;
                  }}
                  onUploadImage={handlePasteImage}
                  value={mdContent}
                />

                <div className="admin-form-actions">
                  <button
                    className="liax-button"
                    disabled={isTranslating || isHydratingContent || isImportingMarkdown}
                    onClick={() => void handleTranslateContent()}
                    type="button"
                  >
                    {isTranslating ? t("article.translating") : `${t("article.translateFrom")} ${sourceLocale}`}
                  </button>
                  <button
                    className="liax-button liax-button--primary"
                    disabled={isSaving || isHydratingContent || isImportingMarkdown || !translation}
                    onClick={() => void handleSave()}
                    type="button"
                  >
                    {isSaving ? t("article.markdownSaving") : t("article.markdownSave")}
                  </button>
                </div>

                {isAutoSaving ? <p className="admin-muted-text">{t("article.autoSaving")}</p> : null}
                {isHydratingContent ? <p className="admin-muted-text">{t("article.markdownLoading")}</p> : null}
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
