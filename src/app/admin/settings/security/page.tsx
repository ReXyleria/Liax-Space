import { SettingsSectionPage } from "@/components/admin/settings-section-page";
import { getAdminLocale, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AdminSecuritySettingsPage() {
  const locale = await getAdminLocale();

  return (
    <SettingsSectionPage
      path="/admin/settings/security"
      locale={locale}
      eyebrow={t(locale, "adminSystem")}
      title={t(locale, "adminSecurity")}
      description={t(locale, "adminSecuritySettingsDescription")}
      emptyText={t(locale, "settingsMissingDefinitions")}
      settingKeys={["register.enabled", "comments.requireApproval", "guestbook.requireApproval"]}
    />
  );
}
