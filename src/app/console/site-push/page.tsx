import { ConsolePageHeader } from "@/components/console/console-page-header";
import { SitePushPanel } from "@/components/console/site-push-panel";
import { getSitePushSettings, listSitePushRecords } from "@/features/site-push/service";
import { requireConsolePermission } from "@/lib/console-guard";
import { t } from "@/lib/i18n";
import { getConsoleLocale } from "@/lib/i18n-server";
import { canManageSettings } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ConsoleSitePushPage() {
  const [locale, user] = await Promise.all([
    getConsoleLocale(),
    requireConsolePermission(canManageSettings, "/console/site-push")
  ]);
  const [{ settings, error }, { records, error: recordsError }] = await Promise.all([
    getSitePushSettings(user),
    listSitePushRecords(user)
  ]);

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow={t(locale, "consoleTools")}
        title={t(locale, "consoleSitePush")}
        description={t(locale, "consoleSitePushDescription")}
      />
      {error || recordsError ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error || recordsError}
        </div>
      ) : null}
      <SitePushPanel
        locale={locale}
        settings={settings}
        records={records.map((record) => ({
          ...record,
          createdAt: record.createdAt.toISOString(),
          submittedAt: record.submittedAt?.toISOString() ?? null
        }))}
      />
    </div>
  );
}
