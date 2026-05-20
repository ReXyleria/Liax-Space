import { CodeInjectionForm } from "@/components/console/code-injection-form";
import { Card } from "@/components/ui/card";
import { getCodeInjectionMap } from "@/features/code-injection/service";
import { requireConsolePermission } from "@/lib/console-guard";
import { t } from "@/lib/i18n";
import { getConsoleLocale } from "@/lib/i18n-server";
import { canManageCodeInjection } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ConsoleSettingsCodeInjectionPage() {
  const locale = await getConsoleLocale();
  await requireConsolePermission(canManageCodeInjection, "/console/settings/code-injection");
  const { settings, error } = await getCodeInjectionMap();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">{t(locale, "consoleSystem")}</p>
        <h1 className="text-3xl font-semibold">{t(locale, "consoleCodeInjection")}</h1>
        <p className="mt-2 text-muted-foreground">{t(locale, "consoleCodeInjectionDescription")}</p>
      </div>
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      <CodeInjectionForm settings={settings} />
    </div>
  );
}
