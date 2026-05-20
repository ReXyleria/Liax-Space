import { SettingsSectionPage } from "@/components/console/settings-section-page";
import { t } from "@/lib/i18n";
import { getConsoleLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function ConsoleSecuritySettingsPage() {
  const locale = await getConsoleLocale();

  return (
    <SettingsSectionPage
      path="/console/settings/security"
      locale={locale}
      eyebrow={t(locale, "consoleSystem")}
      title={t(locale, "consoleSecurity")}
      description={t(locale, "consoleSecuritySettingsDescription")}
      emptyText={t(locale, "settingsMissingDefinitions")}
      settingKeys={["register.enabled", "comments.requireApproval", "guestbook.requireApproval"]}
    />
  );
}
