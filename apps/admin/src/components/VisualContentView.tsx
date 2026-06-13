import type { ReactElement } from "react";

import { useT } from "../i18n/useT";
import { markdownToHtml } from "./MarkdownEditor";

export type VisualContentViewProps = {
  value: string;
};

export function VisualContentView({ value }: VisualContentViewProps): ReactElement {
  const t = useT();

  return (
    <div
      aria-label={t("article.visualContent")}
      className="admin-visual-editor__surface admin-readonly-content"
      dangerouslySetInnerHTML={{ __html: markdownToHtml(value) }}
      role="document"
    />
  );
}
