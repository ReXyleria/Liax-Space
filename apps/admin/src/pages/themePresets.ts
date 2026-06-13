import { colorTokens, type ColorTokenName } from "../../../../packages/ui/src/tokens";

export type ThemePresetId = "warm-minimal" | "quiet-garden" | "clear-graphite";

export type EditableThemeToken = Extract<
  ColorTokenName,
  "--color-surface-muted" | "--color-border" | "--color-primary" | "--color-brand" | "--color-accent"
>;

export type ThemeTokenValues = Record<ColorTokenName, string>;
export type EditableThemeValues = Record<EditableThemeToken, string>;

export type ThemePreset = {
  id: ThemePresetId;
  tokenValues: ThemeTokenValues;
};

export const editableThemeTokens: EditableThemeToken[] = [
  "--color-surface-muted",
  "--color-border",
  "--color-primary",
  "--color-brand",
  "--color-accent"
];

export const themePreviewTokens: Array<"--color-surface-muted" | "--color-primary" | "--color-brand"> = [
  "--color-surface-muted",
  "--color-primary",
  "--color-brand"
];

export const baseThemeTokenValues = colorTokens as ThemeTokenValues;

export const themePresets: ThemePreset[] = [
  {
    id: "warm-minimal",
    tokenValues: baseThemeTokenValues
  },
  {
    id: "quiet-garden",
    tokenValues: {
      ...baseThemeTokenValues,
      "--color-accent": "#5f7a50",
      "--color-border": "#c6d0bf",
      "--color-brand": "#3f6b4a",
      "--color-primary": "#102316",
      "--color-surface-muted": "#edf2e7"
    }
  },
  {
    id: "clear-graphite",
    tokenValues: {
      ...baseThemeTokenValues,
      "--color-accent": "#6a625a",
      "--color-border": "#c7c2b9",
      "--color-brand": "#5a554f",
      "--color-primary": "#111315",
      "--color-surface-muted": "#efeee8"
    }
  }
];
