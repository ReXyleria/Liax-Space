import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";

import { articleApi, type ArticleLocale, type ArticleTranslation } from "../api/articleApi";
import { attachmentApi } from "../api/attachmentApi";
import { ApiError } from "../api/httpClient";
import { translationApi } from "../api/translationApi";
import { versionApi } from "../api/versionApi";
import { extractHeadingsFromMarkdown, MarkdownEditor, type EditorHeading } from "../components/MarkdownEditor";
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

export function ArticleMarkdownEditPage({ articleId, locale }: ArticleMarkdownEditPageProps): ReactElement {
  const t = useT();
  const [translation, setTranslation] = useState<ArticleTranslation | null>(null);
  const [baseVersionId, setBaseVersionId] = useState<number | null>(null);
  const [mdContent, setMdContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastSavedContentRef = useRef("");
  const mdContentRef = useRef("");
  const autoSaveTimerRef = useRef<number | null>(null);
  const suppressNextAutoSaveRef = useRef(false);
  const sourceLocale = oppositeLocale(locale);
  const pageTitle = useMemo(() => `${t("article.markdownTitle")} #${articleId} - ${locale}`, [articleId, locale, t]);
  const headings = useMemo(() => extractHeadingsFromMarkdown(mdContent), [mdContent]);

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
          ? await versionApi.listVersions(articleId, locale)
          : { versions: [] };
        const latestVersion = versionsResponse.versions[0] ?? null;

        if (isMounted) {
          setTranslation(activeTranslation);
          setBaseVersionId(latestVersion?.id ?? null);
          setMdContent(latestVersion?.mdContent ?? "");
          mdContentRef.current = latestVersion?.mdContent ?? "";
          lastSavedContentRef.current = latestVersion?.mdContent ?? "";
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

    if (isLoading || isSaving || isAutoSaving || !translation || mdContent === lastSavedContentRef.current || suppressNextAutoSaveRef.current) {
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
  }, [baseVersionId, isAutoSaving, isLoading, isSaving, mdContent, translation]);

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
      setMdContent(response.version.mdContent);
      mdContentRef.current = response.version.mdContent;
      lastSavedContentRef.current = response.version.mdContent;
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
      const versionsResponse = await versionApi.listVersions(articleId, sourceLocale);
      const latestSourceVersion = versionsResponse.versions[0] ?? null;

      if (!latestSourceVersion || !latestSourceVersion.mdContent.trim()) {
        setErrorMessage(t("article.translateSourceMissing"));
        return;
      }

      const response = await translationApi.translate({
        fields: {
          content: latestSourceVersion.mdContent
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
                  disabled={isSaving || isTranslating}
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
                    disabled={isTranslating}
                    onClick={() => void handleTranslateContent()}
                    type="button"
                  >
                    {isTranslating ? t("article.translating") : `${t("article.translateFrom")} ${sourceLocale}`}
                  </button>
                  <button
                    className="liax-button liax-button--primary"
                    disabled={isSaving || !translation}
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
