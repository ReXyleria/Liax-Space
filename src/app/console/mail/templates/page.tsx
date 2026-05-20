import { ConsolePageHeader } from "@/components/console/console-page-header";
import { MailTemplatesPanel } from "@/components/console/mail-templates-panel";
import { Card } from "@/components/ui/card";
import { listMailTemplates } from "@/features/mail/service";
import { requireConsolePermission } from "@/lib/console-guard";
import { t } from "@/lib/i18n";
import { getConsoleLocale } from "@/lib/i18n-server";
import { canManageMailTemplates } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ConsoleMailTemplatesPage() {
  const [locale, user] = await Promise.all([
    getConsoleLocale(),
    requireConsolePermission(canManageMailTemplates, "/console/mail/templates")
  ]);
  const { templates, logs, error } = await listMailTemplates(user);

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow={t(locale, "consoleMail")}
        title={t(locale, "consoleMailTemplates")}
        description={t(locale, "consoleMailTemplatesDescription")}
      />
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      <MailTemplatesPanel
        locale={locale}
        showLogs={false}
        templates={templates.map((template) => ({
          scene: template.scene,
          category: template.category,
          name: template.name,
          description: template.description,
          subject: template.subject,
          bodyHtml: template.bodyHtml
        }))}
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
