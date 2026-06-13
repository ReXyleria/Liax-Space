import type { ReactElement } from "react";

import { useT } from "../i18n/useT";

export type HtmlPreviewProps = {
  html: string;
  isLoading?: boolean;
};

export function HtmlPreview({ html, isLoading = false }: HtmlPreviewProps): ReactElement {
  const t = useT();
  const emptyPreviewHtml = `<!doctype html><html><body style="margin:0;padding:16px;background:#faf9f5;color:#141413;font-family:system-ui,sans-serif;"><p>${t("article.previewEmpty")}</p></body></html>`;

  return (
    <section className="admin-html-preview" aria-label={t("article.preview")}>
      <div className="admin-html-preview__header">
        <h3>{t("article.preview")}</h3>
        {isLoading ? <span>{t("article.previewLoading")}</span> : null}
      </div>
      <iframe
        className="admin-html-preview__frame"
        sandbox="allow-scripts"
        srcDoc={html || emptyPreviewHtml}
        title={t("article.preview")}
      />
    </section>
  );
}
