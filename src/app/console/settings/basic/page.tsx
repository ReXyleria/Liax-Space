import { SettingsSectionPage } from "@/components/console/settings-section-page";
import { t } from "@/lib/i18n";
import { getConsoleLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function ConsoleBasicSettingsPage() {
  const locale = await getConsoleLocale();

  return (
    <SettingsSectionPage
      path="/console/settings/basic"
      locale={locale}
      eyebrow={t(locale, "consoleSystem")}
      title={t(locale, "consoleBasicSettings")}
      description={t(locale, "consoleBasicSettingsDescription")}
      emptyText={t(locale, "settingsMissingDefinitions")}
      settingKeys={["site.title", "site.subtitle", "site.url", "site.logo", "register.enabled"]}
    />
  );
}
