import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/admin/settings-form";
import { Card } from "@/components/ui/card";
import { getLocalizedSettingDefinitions, getSettingsMap } from "@/features/settings/service";
import { requireAdminAccess } from "@/lib/admin-guard";
import { canManageSettings } from "@/lib/permissions";
import type { Locale } from "@/lib/i18n";

export async function SettingsSectionPage({
  eyebrow,
  title,
  description,
  settingKeys,
  path,
  emptyText,
  locale = "zh-CN"
}: {
  eyebrow: string;
  title: string;
  description: string;
  settingKeys: string[];
  path: string;
  emptyText: string;
  locale?: Locale;
}) {
  const user = await requireAdminAccess(path);
  if (!canManageSettings(user)) {
    redirect("/");
  }

  const { settings, error } = await getSettingsMap();
  const keySet = new Set(settingKeys);
  const definitions = getLocalizedSettingDefinitions(locale).filter((definition) => keySet.has(definition.key));
  const groupTitle = definitions[0]?.group ?? title;
  const groups = {
    [groupTitle]: definitions
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">{eyebrow}</p>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      {definitions.length ? (
        <SettingsForm groups={groups} settings={settings} locale={locale} />
      ) : (
        <Card className="p-6 text-sm text-muted-foreground">{emptyText}</Card>
      )}
    </div>
  );
}
