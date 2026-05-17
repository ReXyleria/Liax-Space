import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ContactItemsForm } from "@/components/admin/contact-items-form";
import { SettingsForm } from "@/components/admin/settings-form";
import { Card } from "@/components/ui/card";
import { parseContactItems } from "@/features/settings/contact-items";
import { getLocalizedSettingDefinitions, getSettingsMap } from "@/features/settings/service";
import { requireAdminAccess } from "@/lib/admin-guard";
import { t } from "@/lib/i18n";
import { getAdminLocale } from "@/lib/i18n-server";
import { canManageSettings } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminFooterSettingsPage() {
  const [locale, user, { settings, error }] = await Promise.all([
    getAdminLocale(),
    requireAdminAccess("/admin/settings/footer"),
    getSettingsMap()
  ]);

  if (!canManageSettings(user)) {
    return null;
  }

  const definitions = getLocalizedSettingDefinitions(locale).filter((definition) =>
    ["record.icp", "record.icpUrl", "record.police", "record.policeUrl"].includes(definition.key)
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={t(locale, "adminAppearance")}
        title={t(locale, "adminFooter")}
        description={
          locale === "en"
            ? "Manage filing links and the public contact list shown across the site."
            : "管理备案链接，以及全站统一展示的公开联系方式列表。"
        }
      />

      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}

      <SettingsForm
        locale={locale}
        settings={settings}
        groups={{
          [locale === "en" ? "Filing information" : "备案信息"]: definitions
        }}
      />

      <ContactItemsForm locale={locale} initialItems={parseContactItems(settings)} />
    </div>
  );
}
