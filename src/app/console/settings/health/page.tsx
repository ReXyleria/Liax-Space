import { ConsolePageHeader } from "@/components/console/console-page-header";
import { SystemHealthPanel } from "@/components/console/system-health-panel";
import { getSystemHealthReport } from "@/features/system-health/service";
import { requireConsolePermission } from "@/lib/console-guard";
import { t } from "@/lib/i18n";
import { getConsoleLocale } from "@/lib/i18n-server";
import { canManageSettings } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ConsoleSystemHealthPage() {
  const [locale, user] = await Promise.all([
    getConsoleLocale(),
    requireConsolePermission(canManageSettings, "/console/settings/health")
  ]);
  const report = await getSystemHealthReport(user);

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow={t(locale, "consoleSystem")}
        title={t(locale, "consoleHealth")}
        description={t(locale, "consoleHealthDescription")}
      />
      <SystemHealthPanel report={report} locale={locale} />
    </div>
  );
}
