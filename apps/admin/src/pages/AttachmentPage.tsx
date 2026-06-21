import { useEffect, useMemo, useState, type ChangeEvent, type ReactElement } from "react";

import { attachmentApi, type Attachment, type AttachmentReferenceType } from "../api/attachmentApi";
import { AdminLoadingSkeleton } from "../components/AdminLoadingSkeleton";
import { useT } from "../i18n/useT";
import { AdminLayout } from "../layout/AdminLayout";

const attachmentReferenceTypeKeys: Record<AttachmentReferenceType, string> = {
  article: "attachment.reference.article",
  avatar: "attachment.reference.avatar",
  moment: "attachment.reference.moment",
  siteLogo: "attachment.reference.siteLogo"
};

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
  const [brokenPreviewIds, setBrokenPreviewIds] = useState<number[]>([]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const brokenPreviewIdSet = useMemo(() => new Set(brokenPreviewIds), [brokenPreviewIds]);

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
      setBrokenPreviewIds([]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t(nextUnusedOnly ? "attachment.unusedLoadFailed" : "attachment.allLoadFailed"));
    } finally {
      setIsLoadingAttachments(false);
    }
  }

  useEffect(() => {
    void loadAttachments("");
  }, []);

  useEffect(() => {
    let isCancelled = false;

    attachments.forEach((attachment) => {
      if (!attachment.publicUrl || !attachment.mimeType.startsWith("image/") || brokenPreviewIdSet.has(attachment.id)) {
        return;
      }

      const probe = new Image();
      probe.onload = () => {
        probe.onload = null;
        probe.onerror = null;
      };
      probe.onerror = () => {
        probe.onload = null;
        probe.onerror = null;
        if (isCancelled) {
          return;
        }
        setBrokenPreviewIds((currentIds) => (
          currentIds.includes(attachment.id) ? currentIds : [...currentIds, attachment.id]
        ));
      };
      probe.src = attachment.publicUrl;
    });

    return () => {
      isCancelled = true;
    };
  }, [attachments, brokenPreviewIdSet]);

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

    if (!window.confirm(t("attachment.deleteUnusedConfirm"))) {
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
                className="liax-button liax-button--danger"
                disabled={isDeleting || selectedIds.length === 0}
                onClick={() => void deleteSelected()}
                type="button"
              >
                {t("attachment.selectedDeleteUnused")}
              </button>
            </div>
          </div>

          {isLoadingAttachments ? (
            <AdminLoadingSkeleton label={t("category.loading")} rows={4} variant="cards" />
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
                  const isBrokenPreview = brokenPreviewIdSet.has(attachment.id);
                  const previewState = !previewUrl ? "missing" : isBrokenPreview ? "failed" : "empty";
                  const previewFallbackLabel = previewState === "missing"
                    ? t("attachment.statusMissingUrl")
                    : previewState === "failed"
                      ? t("attachment.previewFailed")
                      : t("attachment.noPreview");
                  const references = attachment.references ?? [];
                  const visibleReferences = references.slice(0, 4);

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

                      <div className="admin-attachment-status-row">
                        <span className="admin-attachment-status" data-status={attachment.isUsed ? "used" : "unused"}>
                          {t(attachment.isUsed ? "attachment.statusReferenced" : "attachment.statusUnused")}
                        </span>
                        <span className="admin-attachment-status" data-status={!previewUrl || isBrokenPreview ? "missing" : "available"}>
                          {t(!previewUrl ? "attachment.statusMissingUrl" : isBrokenPreview ? "attachment.previewFailed" : "attachment.statusAvailable")}
                        </span>
                      </div>

                      <div className="admin-attachment-references" data-empty={references.length === 0 ? "true" : "false"}>
                        <span className="admin-attachment-references__label">{t("attachment.references")}</span>
                        {visibleReferences.length > 0 ? (
                          <ul>
                            {visibleReferences.map((reference, index) => {
                              const label = `${t(attachmentReferenceTypeKeys[reference.type])} - ${reference.label}`;

                              return (
                                <li className="admin-attachment-reference" key={`${reference.type}-${reference.href ?? "none"}-${index}`}>
                                  {reference.href ? <a href={reference.href}>{label}</a> : <span>{label}</span>}
                                </li>
                              );
                            })}
                            {references.length > visibleReferences.length ? (
                              <li className="admin-attachment-reference">
                                <span>{t("attachment.referencesMore")}: {references.length - visibleReferences.length}</span>
                              </li>
                            ) : null}
                          </ul>
                        ) : (
                          <p className="admin-attachment-references__empty">{t("attachment.referencesEmpty")}</p>
                        )}
                      </div>

                      {previewUrl && !isBrokenPreview ? (
                        <a
                          className="admin-attachment-preview"
                          href={previewUrl}
                          rel="noreferrer"
                          target="_blank"
                          title={t("attachment.openPreview")}
                        >
                          {canPreviewImage ? (
                            <img
                              alt={attachment.originalFilename}
                              onError={() => {
                                setBrokenPreviewIds((currentIds) => (
                                  currentIds.includes(attachment.id) ? currentIds : [...currentIds, attachment.id]
                                ));
                              }}
                              src={previewUrl}
                            />
                          ) : (
                            <span>{attachment.mimeType || t("attachment.noPreview")}</span>
                          )}
                        </a>
                      ) : (
                        <div
                          aria-label={`${t("attachment.preview")}: ${previewFallbackLabel}`}
                          className="admin-attachment-preview admin-attachment-preview--empty"
                          data-state={previewState}
                        >
                          <span>{previewFallbackLabel}</span>
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
