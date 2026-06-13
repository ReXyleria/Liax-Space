import type { ReactElement } from "react";
import type { ArticleLocale } from "../api/articleApi";

import { useT } from "../i18n/useT";

export type LocaleTabsProps = {
  activeLocale: ArticleLocale;
  onChange: (locale: ArticleLocale) => void;
};

const locales: ArticleLocale[] = ["zh-CN", "en-US"];

export function LocaleTabs({ activeLocale, onChange }: LocaleTabsProps): ReactElement {
  const t = useT();

  return (
    <div className="admin-locale-tabs" role="tablist" aria-label={t("article.translationTabs")}>
      {locales.map((locale) => (
        <button
          aria-selected={activeLocale === locale}
          className="admin-locale-tab"
          data-active={activeLocale === locale ? "true" : "false"}
          key={locale}
          onClick={() => onChange(locale)}
          role="tab"
          type="button"
        >
          {t(locale === "zh-CN" ? "locale.zhCN" : "locale.enUS")}
        </button>
      ))}
    </div>
  );
}
