import { useRef, type MouseEvent, type ReactElement } from "react";
import type { SupportedLocale } from "../../../../../packages/shared/src/locales";

import { useLocale } from "../../i18n/useT";
import { useLanguageWipe } from "./LanguageWipeProvider";

function nextLocale(locale: SupportedLocale): SupportedLocale {
  return locale === "zh-CN" ? "en-US" : "zh-CN";
}

function buttonCenter(button: HTMLButtonElement | null): { x: number; y: number } | undefined {
  if (!button) {
    return undefined;
  }

  const rect = button.getBoundingClientRect();

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

export function LanguageSwitchButton(): ReactElement {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { locale, t } = useLocale();
  const { isTransitioning, switchLocale } = useLanguageWipe();
  const targetLocale = nextLocale(locale);
  const label = targetLocale === "en-US" ? "EN" : "中";
  const ariaLabel = targetLocale === "en-US"
    ? t("language.switchToEnglish")
    : t("language.switchToChinese");

  function handleClick(event: MouseEvent<HTMLButtonElement>): void {
    const keyboardTriggered = event.detail === 0;
    const origin = keyboardTriggered
      ? buttonCenter(buttonRef.current)
      : { x: event.clientX, y: event.clientY };

    switchLocale({
      locale: targetLocale,
      origin
    });
  }

  return (
    <button
      aria-label={ariaLabel}
      className="admin-language-switch"
      disabled={isTransitioning}
      onClick={handleClick}
      ref={buttonRef}
      type="button"
    >
      <span aria-hidden="true">{label}</span>
    </button>
  );
}
