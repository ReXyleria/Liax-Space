import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { TranslationSettingsForm } from "@/components/admin/translation-settings-form";
import { listPublicContentTranslationJobs } from "@/features/i18n/public-content-translations";
import { getTranslationSettings } from "@/features/settings/translation-settings";
import { requireAdminPermission } from "@/lib/admin-guard";
import { t } from "@/lib/i18n";
import { getAdminLocale } from "@/lib/i18n-server";
import { canManageSettings } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminTranslationSettingsPage() {
  const [locale, user] = await Promise.all([
    getAdminLocale(),
    requireAdminPermission(canManageSettings, "/admin/settings/translation")
  ]);
  const [{ settings, error }, publicJobResult] = await Promise.all([
    getTranslationSettings(),
    listPublicContentTranslationJobs(user)
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={t(locale, "adminSystem")}
        title={t(locale, "adminTranslation")}
        description={t(locale, "adminTranslationDescription")}
      />
      <TranslationSettingsForm
        settings={settings}
        error={error}
        locale={locale}
        publicJobs={publicJobResult.jobs}
        publicJobsError={publicJobResult.error}
      />
    </div>
  );
}
