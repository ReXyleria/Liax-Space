import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { MailTemplatesPanel } from "@/components/admin/mail-templates-panel";
import { Card } from "@/components/ui/card";
import { listMailTemplates } from "@/features/mail/service";
import { requireAdminPermission } from "@/lib/admin-guard";
import { getAdminLocale, t } from "@/lib/i18n";
import { canManageMailTemplates } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminMailTemplatesPage() {
  const [locale, user] = await Promise.all([
    getAdminLocale(),
    requireAdminPermission(canManageMailTemplates, "/admin/mail/templates")
  ]);
  const { templates, logs, error } = await listMailTemplates(user);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={t(locale, "adminMail")}
        title={t(locale, "adminMailTemplates")}
        description={t(locale, "adminMailTemplatesDescription")}
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
