import { CodeInjectionForm } from "@/components/admin/code-injection-form";
import { Card } from "@/components/ui/card";
import { getCodeInjectionMap } from "@/features/code-injection/service";
import { requireAdminPermission } from "@/lib/admin-guard";
import { getAdminLocale, t } from "@/lib/i18n";
import { canManageCodeInjection } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminSettingsCodeInjectionPage() {
  const locale = await getAdminLocale();
  await requireAdminPermission(canManageCodeInjection, "/admin/settings/code-injection");
  const { settings, error } = await getCodeInjectionMap();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">{t(locale, "adminSystem")}</p>
        <h1 className="text-3xl font-semibold">{t(locale, "adminCodeInjection")}</h1>
        <p className="mt-2 text-muted-foreground">{t(locale, "adminCodeInjectionDescription")}</p>
      </div>
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      <CodeInjectionForm settings={settings} />
    </div>
  );
}
