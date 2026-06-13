import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { editableThemeTokens, themePresets, themePreviewTokens } from "../pages/themePresets";

describe("ThemePage configuration", () => {
  it("keeps the theme chooser to three distinct presets", () => {
    assert.deepEqual(themePresets.map((preset) => preset.id), [
      "warm-minimal",
      "quiet-garden",
      "clear-graphite"
    ]);
  });

  it("shows only a few representative colors before editing", () => {
    assert.deepEqual(themePreviewTokens, [
      "--color-surface-muted",
      "--color-primary",
      "--color-brand"
    ]);
  });

  it("keeps advanced customization inside the edit dialog", () => {
    assert.deepEqual(editableThemeTokens, [
      "--color-surface-muted",
      "--color-border",
      "--color-primary",
      "--color-brand",
      "--color-accent"
    ]);
  });
});
