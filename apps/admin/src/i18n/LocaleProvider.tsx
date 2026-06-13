import { createContext, useMemo, useState, type ReactElement, type ReactNode } from "react";
import type { SupportedLocale } from "../../../../packages/shared/src/locales";

import { enUSDictionary } from "./dictionaries/en-US";
import { zhCNDictionary, type AdminTranslationKey } from "./dictionaries/zh-CN";
import { resolveInitialLocale, writeStoredLocale } from "./localeStorage";

type TranslationDictionary = Readonly<Record<AdminTranslationKey, string>>;

const dictionaries: Record<SupportedLocale, TranslationDictionary> = {
  "en-US": enUSDictionary,
  "zh-CN": zhCNDictionary
};

export type Translate = (key: string) => string;

export type LocaleContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: Translate;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export type LocaleProviderProps = {
  children: ReactNode;
  locale?: SupportedLocale;
  onLocaleChange?: (locale: SupportedLocale) => void;
  persistOnChange?: boolean;
};

export function LocaleProvider({
  children,
  locale: controlledLocale,
  onLocaleChange,
  persistOnChange = true
}: LocaleProviderProps): ReactElement {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => resolveInitialLocale());
  const activeLocale = controlledLocale ?? locale;

  const value = useMemo<LocaleContextValue>(() => {
    const dictionary = dictionaries[activeLocale];

    return {
      locale: activeLocale,
      setLocale(nextLocale) {
        if (controlledLocale === undefined) {
          setLocaleState(nextLocale);
        }

        if (persistOnChange) {
          writeStoredLocale(nextLocale);
        }

        onLocaleChange?.(nextLocale);
      },
      t(key) {
        return dictionary[key as AdminTranslationKey] ?? `[missing:${key}]`;
      }
    };
  }, [activeLocale, controlledLocale, onLocaleChange, persistOnChange]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}
