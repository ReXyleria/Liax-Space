import { SettingsSectionPage } from "@/components/admin/settings-section-page";
import { t } from "@/lib/i18n";
import { getAdminLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function AdminBasicSettingsPage() {
  const locale = await getAdminLocale();

  return (
    <SettingsSectionPage
      path="/admin/settings/basic"
      locale={locale}
      eyebrow={t(locale, "adminSystem")}
      title={t(locale, "adminBasicSettings")}
      description={t(locale, "adminBasicSettingsDescription")}
      emptyText={t(locale, "settingsMissingDefinitions")}
      settingKeys={["site.title", "site.subtitle", "site.url", "site.logo", "register.enabled"]}
    />
  );
}
