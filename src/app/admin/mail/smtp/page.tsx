import { SmtpSettingsForm } from "@/components/admin/smtp-settings-form";
import { Card } from "@/components/ui/card";
import { getSettingsMap } from "@/features/settings/service";
import { requireAdminPermission } from "@/lib/admin-guard";
import { t } from "@/lib/i18n";
import { getAdminLocale } from "@/lib/i18n-server";
import { canManageSettings } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminSmtpSettingsPage() {
  const [locale] = await Promise.all([
    getAdminLocale(),
    requireAdminPermission(canManageSettings, "/admin/mail/smtp")
  ]);
  const { settings, error } = await getSettingsMap();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">{t(locale, "adminMail")}</p>
        <h1 className="text-3xl font-semibold">{t(locale, "adminSmtp")}</h1>
        <p className="mt-2 text-muted-foreground">{t(locale, "adminSmtpDescription")}</p>
      </div>
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      <SmtpSettingsForm settings={settings} locale={locale} />
    </div>
  );
}
