import { ConsolePageHeader } from "@/components/console/console-page-header";
import { MailLogsPanel } from "@/components/console/mail-logs-panel";
import { Card } from "@/components/ui/card";
import { listMailTemplates } from "@/features/mail/service";
import { requireConsolePermission } from "@/lib/console-guard";
import { t } from "@/lib/i18n";
import { getConsoleLocale } from "@/lib/i18n-server";
import { canManageMailTemplates } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ConsoleMailLogsPage() {
  const [locale, user] = await Promise.all([
    getConsoleLocale(),
    requireConsolePermission(canManageMailTemplates, "/console/mail/logs")
  ]);
  const { logs, error } = await listMailTemplates(user);

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow={t(locale, "consoleMail")}
        title={t(locale, "consoleMailLogs")}
        description={t(locale, "consoleMailLogsDescription")}
      />
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      <MailLogsPanel
        locale={locale}
        logs={logs.map((log) => ({
          id: log.id,
          scene: log.scene,
          to: log.to,
          subject: log.subject,
          status: log.status,
          error: log.error,
          createdAtLabel: formatDate(log.createdAt)
        }))}
      />
    </div>
  );
}
