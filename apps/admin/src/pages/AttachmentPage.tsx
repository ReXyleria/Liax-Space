import { useEffect, useMemo, useState, type ChangeEvent, type ReactElement } from "react";

import { attachmentApi, type Attachment } from "../api/attachmentApi";
import { useT } from "../i18n/useT";
import { AdminLayout } from "../layout/AdminLayout";

export function AttachmentPage(): ReactElement {
  const t = useT();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  async function loadAttachments(nextSearch = search): Promise<void> {
    setIsLoadingAttachments(true);
    setErrorMessage(null);

    try {
      const response = await attachmentApi.listAttachments({
        search: nextSearch
      });
      setAttachments(Array.isArray(response.attachments) ? response.attachments : []);
      setSelectedIds([]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("attachment.allLoadFailed"));
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
      await loadAttachments(search);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("attachment.allLoadFailed"));
    } finally {
      setIsDeleting(false);
    }
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
              <span>{t("attachment.searchAll")}</span>
              <input onChange={handleSearchChange} type="search" value={search} />
            </label>
            <div className="admin-form-actions">
              <button className="liax-button" disabled={isLoadingAttachments} onClick={() => void loadAttachments(search)} type="button">
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
            <p className="admin-muted-text">{t("attachment.allEmpty")}</p>
          ) : (
            <div className="admin-table-card">
              <table className="admin-article-table admin-users-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        aria-label={t("attachment.selectAll")}
                        checked={selectedIds.length === attachments.length && attachments.length > 0}
                        onChange={(event) => toggleAll(event.target.checked)}
                        type="checkbox"
                      />
                    </th>
                    <th>{t("attachment.id")}</th>
                    <th>{t("attachment.filename")}</th>
                    <th>URL</th>
                    <th>SHA256</th>
                  </tr>
                </thead>
                <tbody>
                  {attachments.map((attachment) => (
                    <tr key={attachment.id}>
                      <td>
                        <input
                          aria-label={`${t("attachment.select")} #${attachment.id}`}
                          checked={selectedIdSet.has(attachment.id)}
                          onChange={(event) => toggleSelected(attachment.id, event.target.checked)}
                          type="checkbox"
                        />
                      </td>
                      <td>{attachment.id}</td>
                      <td>{attachment.originalFilename}</td>
                      <td><code>{attachment.publicUrl ?? attachment.storageKey}</code></td>
                      <td><code>{attachment.sha256.slice(0, 16)}...</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {message ? <p className="admin-success-text">{message}</p> : null}
          {errorMessage ? <p className="admin-error-text">{errorMessage}</p> : null}
        </div>
      </section>
    </AdminLayout>
  );
}
