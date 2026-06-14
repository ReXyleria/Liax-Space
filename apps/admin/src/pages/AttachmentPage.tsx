import { useEffect, useMemo, useState, type ChangeEvent, type ReactElement } from "react";

import { attachmentApi, type Attachment } from "../api/attachmentApi";
import { useT } from "../i18n/useT";
import { AdminLayout } from "../layout/AdminLayout";

export function AttachmentPage(): ReactElement {
  const t = useT();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [unusedOnly, setUnusedOnly] = useState(false);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  async function loadAttachments(nextSearch = search, nextUnusedOnly = unusedOnly): Promise<void> {
    setIsLoadingAttachments(true);
    setErrorMessage(null);

    try {
      const response = await attachmentApi.listAttachments({
        search: nextSearch,
        unusedOnly: nextUnusedOnly
      });
      setAttachments(Array.isArray(response.attachments) ? response.attachments : []);
      setSelectedIds([]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t(nextUnusedOnly ? "attachment.unusedLoadFailed" : "attachment.allLoadFailed"));
    } finally {
      setIsLoadingAttachments(false);
    }
  }

  useEffect(() => {
    void loadAttachments("");
  }, []);

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>): void {
    setSearch(event.target.value);
  }

  function handleUnusedOnlyChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextUnusedOnly = event.target.checked;

    setUnusedOnly(nextUnusedOnly);
    void loadAttachments(search, nextUnusedOnly);
  }

  function toggleSelected(id: number, checked: boolean): void {
    setSelectedIds((currentIds) => checked
      ? [...currentIds, id]
      : currentIds.filter((currentId) => currentId !== id));
  }

  function toggleAll(checked: boolean): void {
    setSelectedIds(checked ? attachments.map((attachment) => attachment.id) : []);
  }

  async function deleteSelected(): Promise<void> {
    if (selectedIds.length === 0) {
      setErrorMessage(t("users.selectRequired"));
      return;
    }

    setIsDeleting(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const result = await attachmentApi.deleteAttachments(selectedIds);
      setMessage(`${t("attachment.unusedDeleted")}: ${result.deleted}`);
      await loadAttachments(search, unusedOnly);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("attachment.allLoadFailed"));
    } finally {
      setIsDeleting(false);
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

  function formatDate(value: string): string {
    return new Intl.DateTimeFormat(navigator.language || "zh-CN", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  }

  return (
    <AdminLayout>
      <section className="admin-page-header">
        <div>
          <p className="admin-kicker">{t("attachment.kicker")}</p>
          <h2>{t("attachment.title")}</h2>
        </div>
      </section>

      <section className="liax-card admin-attachment-unused">
        <div className="liax-card__header">
          <h3>{t("attachment.libraryTitle")}</h3>
        </div>
        <div className="liax-card__body">
          <div className="admin-users-toolbar">
            <label className="admin-form-field">
              <span>{t(unusedOnly ? "attachment.searchUnused" : "attachment.searchAll")}</span>
              <input onChange={handleSearchChange} type="search" value={search} />
            </label>
            <div className="admin-form-actions">
              <label className="admin-attachment-filter-toggle">
                <input checked={unusedOnly} onChange={handleUnusedOnlyChange} type="checkbox" />
                <span>{t("attachment.showUnusedOnly")}</span>
              </label>
              <button className="liax-button" disabled={isLoadingAttachments} onClick={() => void loadAttachments(search, unusedOnly)} type="button">
                {t("users.searchAction")}
              </button>
              <button
                className="liax-button liax-button--primary"
                disabled={isDeleting || selectedIds.length === 0}
                onClick={() => void deleteSelected()}
                type="button"
              >
                {t("attachment.selectedDeleteUnused")}
              </button>
            </div>
          </div>

          {isLoadingAttachments ? (
            <p className="admin-muted-text">{t("category.loading")}</p>
          ) : attachments.length === 0 ? (
            <p className="admin-muted-text">{t(unusedOnly ? "attachment.unusedEmpty" : "attachment.allEmpty")}</p>
          ) : (
            <>
              <label className="admin-attachment-select-all">
                <input
                  aria-label={t("attachment.selectAll")}
                  checked={selectedIds.length === attachments.length && attachments.length > 0}
                  onChange={(event) => toggleAll(event.target.checked)}
                  type="checkbox"
                />
                <span>{t("attachment.selectAll")}</span>
              </label>
              <div className="admin-attachment-grid">
                {attachments.map((attachment) => {
                  const previewUrl = attachment.publicUrl;
                  const canPreviewImage = Boolean(previewUrl) && attachment.mimeType.startsWith("image/");

                  return (
                    <article className="admin-attachment-card" key={attachment.id}>
                      <label className="admin-attachment-card__select">
                        <input
                          aria-label={`${t("attachment.select")} ${attachment.originalFilename}`}
                          checked={selectedIdSet.has(attachment.id)}
                          onChange={(event) => toggleSelected(attachment.id, event.target.checked)}
                          type="checkbox"
                        />
                        <span>{attachment.originalFilename}</span>
                      </label>

                      {previewUrl ? (
                        <a
                          className="admin-attachment-preview"
                          href={previewUrl}
                          rel="noreferrer"
                          target="_blank"
                          title={t("attachment.openPreview")}
                        >
                          {canPreviewImage ? (
                            <img alt={attachment.originalFilename} src={previewUrl} />
                          ) : (
                            <span>{attachment.mimeType || t("attachment.noPreview")}</span>
                          )}
                        </a>
                      ) : (
                        <div className="admin-attachment-preview admin-attachment-preview--empty">
                          <span>{t("attachment.noPreview")}</span>
                        </div>
                      )}

                      <dl className="admin-attachment-card__meta">
                        <div>
                          <dt>{t("attachment.size")}</dt>
                          <dd>{formatBytes(attachment.sizeBytes)}</dd>
                        </div>
                        <div>
                          <dt>{t("attachment.createdAt")}</dt>
                          <dd>{formatDate(attachment.createdAt)}</dd>
                        </div>
                        <div>
                          <dt>SHA256</dt>
                          <dd><code>{attachment.sha256.slice(0, 16)}...</code></dd>
                        </div>
                      </dl>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {message ? <p className="admin-success-text">{message}</p> : null}
          {errorMessage ? <p className="admin-error-text">{errorMessage}</p> : null}
        </div>
      </section>
    </AdminLayout>
  );
}
