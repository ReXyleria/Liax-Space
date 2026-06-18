import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import { settingsApi } from "../api/settingsApi";
import { useT } from "../i18n/useT";
import { AdminLayout } from "../layout/AdminLayout";
import { applySiteTheme, notifySiteAppearanceUpdated } from "../theme/siteTheme";
import {
  baseThemeTokenValues,
  editableThemeTokens,
  themePresets,
  themePreviewTokens,
  type EditableThemeValues,
  type ThemePreset,
  type ThemePresetId,
  type ThemeTokenValues
} from "./themePresets";

function isThemePresetId(value: unknown): value is ThemePresetId {
  return themePresets.some((preset) => preset.id === value);
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function emptyCustomThemeValues(): Partial<Record<ThemePresetId, Partial<EditableThemeValues>>> {
  return {};
}

function readCustomThemeValues(value: unknown): Partial<Record<ThemePresetId, Partial<EditableThemeValues>>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyCustomThemeValues();
  }

  const result = emptyCustomThemeValues();

  for (const preset of themePresets) {
    const source = (value as Record<string, unknown>)[preset.id];

    if (!source || typeof source !== "object" || Array.isArray(source)) {
      continue;
    }

    const nextValues: Partial<EditableThemeValues> = {};

    for (const tokenName of editableThemeTokens) {
      const color = (source as Record<string, unknown>)[tokenName];

      if (typeof color === "string" && isHexColor(color)) {
        nextValues[tokenName] = color;
      }
    }

    result[preset.id] = nextValues;
  }

  return result;
}

function mergeCustomValues(
  preset: ThemePreset,
  customThemeValues: Partial<Record<ThemePresetId, Partial<EditableThemeValues>>>
): ThemeTokenValues {
  return {
    ...preset.tokenValues,
    ...customThemeValues[preset.id]
  };
}

function toEditableValues(values: ThemeTokenValues): EditableThemeValues {
  return {
    "--color-accent": values["--color-accent"],
    "--color-border": values["--color-border"],
    "--color-brand": values["--color-brand"],
    "--color-primary": values["--color-primary"],
    "--color-surface-muted": values["--color-surface-muted"]
  };
}

export function ThemePage(): ReactElement {
  const t = useT();
  const [selectedPresetId, setSelectedPresetId] = useState<ThemePresetId>("warm-minimal");
  const [customThemeValues, setCustomThemeValues] = useState<Partial<Record<ThemePresetId, Partial<EditableThemeValues>>>>(() => emptyCustomThemeValues());
  const [editingPresetId, setEditingPresetId] = useState<ThemePresetId | null>(null);
  const [editValues, setEditValues] = useState<EditableThemeValues>(() => toEditableValues(baseThemeTokenValues));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const visiblePresets = useMemo(
    () => themePresets.map((preset) => ({
      ...preset,
      tokenValues: mergeCustomValues(preset, customThemeValues)
    })),
    [customThemeValues]
  );
  const selectedPreset = visiblePresets.find((preset) => preset.id === selectedPresetId) ?? visiblePresets[0];
  const editingPreset = editingPresetId
    ? visiblePresets.find((preset) => preset.id === editingPresetId) ?? visiblePresets[0]
    : null;

  useEffect(() => {
    let isMounted = true;

    async function loadThemePreset(): Promise<void> {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await settingsApi.getSiteSettings();
        const preset = response.settings["theme.preset"];
        const customColors = readCustomThemeValues(response.settings["theme.customColors"]);

        if (isMounted) {
          applySiteTheme(response.settings);
          setCustomThemeValues(customColors);

          if (isThemePresetId(preset)) {
            setSelectedPresetId(preset);
          }
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : t("settings.loadFailed"));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadThemePreset();

    return () => {
      isMounted = false;
    };
  }, [t]);

  async function saveThemePreset(nextPresetId = selectedPresetId): Promise<void> {
    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await settingsApi.updateSiteSettings({
        "theme.customColors": customThemeValues,
        "theme.preset": nextPresetId
      });
      notifySiteAppearanceUpdated(response.settings);
      setSelectedPresetId(nextPresetId);
      setMessage(t("theme.saved"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("theme.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  function startEditingPreset(presetId: ThemePresetId): void {
    const preset = visiblePresets.find((item) => item.id === presetId) ?? visiblePresets[0];

    setEditingPresetId(presetId);
    setEditValues(toEditableValues(preset.tokenValues));
    setMessage(null);
    setErrorMessage(null);
  }

  async function saveEditedPreset(): Promise<void> {
    if (!editingPresetId) {
      return;
    }

    if (!editableThemeTokens.every((tokenName) => isHexColor(editValues[tokenName]))) {
      setErrorMessage(t("theme.customInvalid"));
      return;
    }

    const nextCustomValues = {
      ...customThemeValues,
      [editingPresetId]: editValues
    };

    setIsSaving(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const response = await settingsApi.updateSiteSettings({
        "theme.customColors": nextCustomValues,
        "theme.preset": editingPresetId
      });
      notifySiteAppearanceUpdated(response.settings);
      setCustomThemeValues(nextCustomValues);
      setSelectedPresetId(editingPresetId);
      setEditingPresetId(null);
      setMessage(t("theme.saved"));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("theme.saveFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminLayout>
      <section className="admin-page-header">
        <div>
          <p className="admin-kicker">{t("theme.kicker")}</p>
          <h2>{t("theme.title")}</h2>
        </div>
      </section>

      <section className="liax-card">
        <div className="liax-card__body">
          <p className="admin-muted-text admin-page-intro">{t("theme.summary")}</p>

          {isLoading ? (
            <div className="admin-theme-skeleton-grid" aria-label={t("settings.loading")}>
              {[0, 1, 2].map((item) => (
                <div className="admin-theme-skeleton-card" key={item}>
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-theme-preset-grid" aria-label={t("theme.presets")}>
              {visiblePresets.map((preset) => (
              <article
                className="admin-theme-preset-card"
                data-active={preset.id === selectedPresetId}
                key={preset.id}
                style={{
                  "--preview-accent": preset.tokenValues["--color-accent"],
                  "--preview-brand": preset.tokenValues["--color-brand"],
                  "--preview-border": preset.tokenValues["--color-border"],
                  "--preview-primary": preset.tokenValues["--color-primary"],
                  "--preview-surface-muted": preset.tokenValues["--color-surface-muted"]
                } as CSSProperties}
              >
                <div>
                  <h3>{t(`theme.preset.${preset.id}.name`)}</h3>
                  <p>{t(`theme.preset.${preset.id}.description`)}</p>
                  <small>{t(`theme.preset.${preset.id}.bestFor`)}</small>
                </div>
                <span className="admin-theme-preset-card__swatches" aria-hidden="true">
                  {themePreviewTokens.map((tokenName) => (
                    <i key={tokenName} style={{ backgroundColor: preset.tokenValues[tokenName] }} />
                  ))}
                </span>
                <div className="admin-theme-mini-preview" aria-hidden="true">
                  <span />
                  <strong>{t("theme.previewTitle")}</strong>
                  <p>{t("theme.previewText")}</p>
                </div>
                <div className="admin-theme-preset-card__actions">
                  <button className="liax-button liax-button--primary" disabled={isSaving} onClick={() => void saveThemePreset(preset.id)} type="button">
                    {preset.id === selectedPresetId ? t("theme.selected") : t("theme.use")}
                  </button>
                  <button className="liax-button" disabled={isSaving} onClick={() => startEditingPreset(preset.id)} type="button">
                    {t("theme.edit")}
                  </button>
                </div>
              </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {editingPreset ? (
        <div className="admin-modal-backdrop" role="presentation">
          <section aria-labelledby="theme-editor-title" aria-modal="true" className="admin-modal admin-theme-editor-modal" role="dialog">
            <div className="admin-modal__header">
              <div>
                <p className="admin-kicker">{t("theme.kicker")}</p>
                <h3 id="theme-editor-title">{t("theme.editTitle")}</h3>
              </div>
              <button className="liax-button" disabled={isSaving} onClick={() => setEditingPresetId(null)} type="button">
                {t("users.cancel")}
              </button>
            </div>
            <div className="admin-modal__body">
              <p className="admin-muted-text admin-page-intro">{t("theme.editHelp")}</p>
              <div className="admin-theme-edit-grid">
                {editableThemeTokens.map((tokenName) => (
                  <label className="admin-theme-color-field" key={tokenName}>
                    <span>{t(`theme.color.${tokenName}`)}</span>
                    <small>{t(`theme.colorHelp.${tokenName}`)}</small>
                    <input
                      onChange={(event) => {
                        const color = event.target.value;
                        setEditValues((current) => ({ ...current, [tokenName]: color }));
                      }}
                      type="color"
                      value={editValues[tokenName]}
                    />
                  </label>
                ))}
              </div>
              <div
                className="admin-theme-sample"
                style={{
                  "--preview-accent": editValues["--color-accent"],
                  "--preview-brand": editValues["--color-brand"],
                  "--preview-brand-text": editingPreset.tokenValues["--color-brand-text"],
                  "--preview-border": editValues["--color-border"],
                  "--preview-primary": editValues["--color-primary"],
                  "--preview-primary-text": editingPreset.tokenValues["--color-primary-text"],
                  "--preview-surface-muted": editValues["--color-surface-muted"],
                  "--preview-text": editingPreset.tokenValues["--color-text"]
                } as CSSProperties}
              >
                <button className="admin-theme-sample__primary" type="button">{t("theme.primaryButton")}</button>
                <button className="admin-theme-sample__brand-button" type="button">{t("theme.brandButton")}</button>
                <a className="admin-theme-sample__link" href="#theme">{t("theme.linkSample")}</a>
              </div>
              <div className="admin-form-actions">
                <button className="liax-button liax-button--primary" disabled={isSaving} onClick={() => void saveEditedPreset()} type="button">
                  {isSaving ? t("settings.saving") : t("theme.saveCustom")}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {message ? <p className="admin-success-text">{message}</p> : null}
      {errorMessage ? <p className="admin-error-text">{errorMessage}</p> : null}
    </AdminLayout>
  );
}
