import { useState, type ChangeEvent, type ReactElement } from "react";

import { attachmentApi, type AttachmentUploadResult } from "../api/attachmentApi";
import { useT } from "../i18n/useT";

export type FileUploaderProps = {
  onInsert?: (markdown: string) => void;
  onUploaded?: (result: AttachmentUploadResult) => void;
};

const acceptedImageTypes = "image/jpeg,image/png,image/webp,image/gif";

export function FileUploader({ onInsert, onUploaded }: FileUploaderProps): ReactElement {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AttachmentUploadResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    setFile(event.target.files?.[0] ?? null);
    setResult(null);
    setMessage(null);
    setErrorMessage(null);
  }

  async function handleUpload(): Promise<void> {
    if (!file) {
      setErrorMessage(t("attachment.fileRequired"));
      return;
    }

    setIsUploading(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const uploadResult = await attachmentApi.uploadAttachment(file);
      setResult(uploadResult);
      setMessage(t("attachment.uploaded"));
      onUploaded?.(uploadResult);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("attachment.uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  }

  function handleInsert(): void {
    if (!result) {
      return;
    }

    onInsert?.(result.markdown);
    setMessage(t("attachment.inserted"));
  }

  async function handleCopy(): Promise<void> {
    if (!result || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(result.markdown);
    setMessage(t("attachment.copied"));
  }

  return (
    <section className="admin-uploader">
      <label className="admin-form-field">
        <span>{t("attachment.file")}</span>
        <input accept={acceptedImageTypes} disabled={isUploading} onChange={handleFileChange} type="file" />
      </label>

      <div className="admin-form-actions">
        <button
          className="liax-button liax-button--primary"
          disabled={isUploading || !file}
          onClick={() => void handleUpload()}
          type="button"
        >
          {isUploading ? t("attachment.uploading") : t("attachment.upload")}
        </button>
      </div>

      {result ? (
        <div className="admin-code-snippet">
          <p>{t("attachment.markdownSnippet")}</p>
          <code>{result.markdown}</code>
          <div className="admin-form-actions">
            {onInsert ? (
              <button className="liax-button" onClick={handleInsert} type="button">
                {t("attachment.insertMarkdown")}
              </button>
            ) : null}
            <button className="liax-button" onClick={() => void handleCopy()} type="button">
              {t("attachment.copyMarkdown")}
            </button>
          </div>
        </div>
      ) : null}

      {message ? <p className="admin-success-text">{message}</p> : null}
      {errorMessage ? <p className="admin-error-text">{errorMessage}</p> : null}
    </section>
  );
}
