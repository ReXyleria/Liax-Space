import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { SitePushPanel } from "@/components/admin/site-push-panel";
import { getSitePushSettings, listSitePushRecords } from "@/features/site-push/service";
import { requireAdminPermission } from "@/lib/admin-guard";
import { t } from "@/lib/i18n";
import { getAdminLocale } from "@/lib/i18n-server";
import { canManageSettings } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminSitePushPage() {
  const [locale, user] = await Promise.all([
    getAdminLocale(),
    requireAdminPermission(canManageSettings, "/admin/site-push")
  ]);
  const [{ settings, error }, { records, error: recordsError }] = await Promise.all([
    getSitePushSettings(user),
    listSitePushRecords(user)
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={t(locale, "adminTools")}
        title={t(locale, "adminSitePush")}
        description={t(locale, "adminSitePushDescription")}
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
