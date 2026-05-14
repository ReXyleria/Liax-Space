import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { TranslationSettingsForm } from "@/components/admin/translation-settings-form";
import { getTranslationSettings } from "@/features/settings/translation-settings";
import { requireAdminPermission } from "@/lib/admin-guard";
import { getAdminLocale, t } from "@/lib/i18n";
import { canManageSettings } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminTranslationSettingsPage() {
  const [locale] = await Promise.all([
    getAdminLocale(),
    requireAdminPermission(canManageSettings, "/admin/settings/translation")
  ]);
  const { settings, error } = await getTranslationSettings();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={t(locale, "adminSystem")}
        title={t(locale, "adminTranslation")}
        description={t(locale, "adminTranslationDescription")}
      />
      <TranslationSettingsForm settings={settings} error={error} locale={locale} />
    </div>
  );
}