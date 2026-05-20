import { ConsolePageHeader } from "@/components/console/console-page-header";
import { TranslationSettingsForm } from "@/components/console/translation-settings-form";
import { listPublicContentTranslationJobs } from "@/features/i18n/public-content-translations";
import { getTranslationSettings } from "@/features/settings/translation-settings";
import { requireConsolePermission } from "@/lib/console-guard";
import { t } from "@/lib/i18n";
import { getConsoleLocale } from "@/lib/i18n-server";
import { canManageSettings } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ConsoleTranslationSettingsPage() {
  const [locale, user] = await Promise.all([
    getConsoleLocale(),
    requireConsolePermission(canManageSettings, "/console/settings/translation")
  ]);
  const [{ settings, error }, publicJobResult] = await Promise.all([
    getTranslationSettings(),
    listPublicContentTranslationJobs(user)
  ]);

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow={t(locale, "consoleSystem")}
        title={t(locale, "consoleTranslation")}
        description={t(locale, "consoleTranslationDescription")}
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
