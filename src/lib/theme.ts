import type { CSSProperties } from "react";
import type { SettingsMap } from "@/features/settings/types";

function normalizeHex(value?: string | null) {
  const hex = value?.trim() ?? "";
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : null;
}

function hexToRgb(hex: string) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16)
  };
}

function rgbToHsl({ r, g, b }: { r: number; g: number; b: number }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness };
  }

  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue = 0;
  switch (max) {
    case red:
      hue = (green - blue) / delta + (green < blue ? 6 : 0);
      break;
    case green:
      hue = (blue - red) / delta + 2;
      break;
    default:
      hue = (red - green) / delta + 4;
      break;
  }

  hue /= 6;

  return {
    h: Math.round(hue * 360),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100)
  };
}

function rgbToLuminance({ r, g, b }: { r: number; g: number; b: number }) {
  const [red, green, blue] = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function toHslVariable(hex: string) {
  const { h, s, l } = rgbToHsl(hexToRgb(hex));
  return `${h} ${s}% ${l}%`;
}

function contrastForeground(hex: string) {
  return rgbToLuminance(hexToRgb(hex)) > 0.45 ? "232 43% 13%" : "0 0% 100%";
}

function clampNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

export function getThemeStyle(settings: SettingsMap): CSSProperties {
  const primary = normalizeHex(settings["theme.primary"]);
  const accent = normalizeHex(settings["theme.accent"]);
  const overlayOpacity = clampNumber(settings["appearance.backgroundOverlayOpacity"], 30, 0, 90) / 100;
  const backgroundBlur = clampNumber(settings["appearance.backgroundBlur"], 14, 0, 32);
  const style: Record<string, string> = {};

  if (primary) {
    style["--primary"] = toHslVariable(primary);
    style["--primary-foreground"] = contrastForeground(primary);
    style["--ring"] = toHslVariable(primary);
  }

  if (accent) {
    style["--accent"] = toHslVariable(accent);
    style["--accent-foreground"] = contrastForeground(accent);
  }

  style["--site-background-overlay-opacity"] = overlayOpacity.toFixed(2);
  style["--site-background-blur"] = `${backgroundBlur}px`;

  return style as CSSProperties;
}
