import type { ReactElement } from "react";

import { useT } from "../i18n/useT";

export type TranslationMetadataFormValue = {
  publishedAt: string;
  title: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  summary: string;
};

export type SeoFieldsProps = {
  canGenerateSeo?: boolean;
  disabled?: boolean;
  isGeneratingSeo?: boolean;
  onGenerateSeo?: () => void;
  value: TranslationMetadataFormValue;
  onChange: (value: TranslationMetadataFormValue) => void;
};

export function SeoFields({
  canGenerateSeo = true,
  disabled = false,
  isGeneratingSeo = false,
  onChange,
  onGenerateSeo,
  value
}: SeoFieldsProps): ReactElement {
  const t = useT();
  const hasSeoDescription = value.seoDescription.trim().length > 0;

  function updateField(field: keyof TranslationMetadataFormValue, nextValue: string): void {
    onChange({
      ...value,
      [field]: nextValue
    });
  }

  return (
    <div className="admin-metadata-fields">
      <label className="admin-form-field">
        <span>{t("article.field.title")}</span>
        <input
          disabled={disabled}
          onChange={(event) => updateField("title", event.target.value)}
          type="text"
          value={value.title}
        />
      </label>

      <label className="admin-form-field">
        <span>{t("article.field.slug")}</span>
        <input
          disabled={disabled}
          onChange={(event) => updateField("slug", event.target.value)}
          type="text"
          value={value.slug}
        />
      </label>

      {onGenerateSeo ? (
        <div className="admin-seo-tools">
          <div className="admin-seo-tools__copy">
            <strong>{t("article.seoGenerate")}</strong>
            <span>{t("article.seoGenerateHelp")}</span>
          </div>
          <button
            className="liax-button"
            disabled={disabled || isGeneratingSeo || !canGenerateSeo}
            onClick={onGenerateSeo}
            type="button"
          >
            {isGeneratingSeo ? t("article.seoGenerating") : t("article.seoGenerateAction")}
          </button>
        </div>
      ) : null}

      <label className="admin-form-field">
        <span>{t("article.field.seoTitle")}</span>
        <input
          disabled={disabled}
          onChange={(event) => updateField("seoTitle", event.target.value)}
          type="text"
          value={value.seoTitle}
        />
      </label>

      <label className="admin-form-field">
        <span>{t("article.field.seoDescription")}</span>
        <textarea
          disabled={disabled}
          onChange={(event) => updateField("seoDescription", event.target.value)}
          rows={3}
          value={value.seoDescription}
        />
      </label>

      {hasSeoDescription ? (
        <p className="admin-muted-text">{t("article.summarySkippedWhenSeoDescription")}</p>
      ) : (
        <label className="admin-form-field">
          <span>{t("article.field.summary")}</span>
          <textarea
            disabled={disabled}
            onChange={(event) => updateField("summary", event.target.value)}
            rows={4}
            value={value.summary}
          />
        </label>
      )}
    </div>
  );
}
