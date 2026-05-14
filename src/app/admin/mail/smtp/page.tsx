import { SettingsSectionPage } from "@/components/admin/settings-section-page";
import { getAdminLocale, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AdminSmtpSettingsPage() {
  const locale = await getAdminLocale();

  return (
    <SettingsSectionPage
      path="/admin/mail/smtp"
      eyebrow={t(locale, "adminMail")}
      title={t(locale, "adminSmtp")}
      description={t(locale, "adminSmtpDescription")}
      emptyText={t(locale, "settingsMissingDefinitions")}
      settingKeys={[
        "smtp.host",
        "smtp.port",
        "smtp.user",
        "smtp.pass",
        "smtp.from",
        "smtp.notificationsEnabled"
      ]}
    />
  );
}
