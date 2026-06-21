import { useEffect, useRef, useState, type ReactElement } from "react";

import { useT } from "../i18n/useT";
import {
  createIncrementalMarkdownPreview,
  incrementalVisualPreviewChunkLength,
  incrementalVisualPreviewInitialLength,
  markdownToHtml,
  shouldUsePlainMarkdownEditor
} from "./MarkdownEditor";

export type VisualContentViewProps = {
  value: string;
};

export function VisualContentView({ value }: VisualContentViewProps): ReactElement {
  const t = useT();
  const documentKeyRef = useRef<string | null>(null);
  const [previewLength, setPreviewLength] = useState(incrementalVisualPreviewInitialLength);
  const isLargeDocument = shouldUsePlainMarkdownEditor(value);
  const preview = isLargeDocument
    ? createIncrementalMarkdownPreview(value, previewLength)
    : createIncrementalMarkdownPreview(value, value.length);
  const previewPercent = preview.totalLength > 0
    ? Math.min(100, Math.round((preview.renderedLength / preview.totalLength) * 100))
    : 100;

  useEffect(() => {
    const nextDocumentKey = value.slice(0, 512);

    if (documentKeyRef.current === nextDocumentKey) {
      return;
    }

    documentKeyRef.current = nextDocumentKey;
    setPreviewLength(incrementalVisualPreviewInitialLength);
  }, [value]);

  return (
    <>
      {isLargeDocument ? (
        <div className="admin-visual-editor__incremental-bar">
          <span>{t("article.editorVisualPreviewReadonly")} {previewPercent}%</span>
          {preview.hasMore ? (
            <button
              className="liax-button"
              onClick={() => setPreviewLength((currentLength) => currentLength + incrementalVisualPreviewChunkLength)}
              type="button"
            >
              {t("article.editorLoadMoreVisual")}
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        aria-label={t("article.visualContent")}
        className="admin-visual-editor__surface admin-readonly-content"
        dangerouslySetInnerHTML={{ __html: markdownToHtml(preview.markdown) }}
        role="document"
      />
    </>
  );
}
