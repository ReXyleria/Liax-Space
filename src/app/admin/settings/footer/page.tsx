import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ContactItemsForm } from "@/components/admin/contact-items-form";
import { SettingsForm } from "@/components/admin/settings-form";
import { Card } from "@/components/ui/card";
import { parseContactItems } from "@/features/settings/contact-items";
import { getLocalizedSettingDefinitions, getSettingsMap } from "@/features/settings/service";
import type { SettingDefinition } from "@/features/settings/types";
import { requireAdminAccess } from "@/lib/admin-guard";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n-messages";
import { getAdminLocale } from "@/lib/i18n-server";
import { canManageSettings } from "@/lib/permissions";

export const dynamic = "force-dynamic";

function localizeFooterDefinitions(locale: Locale, definitions: SettingDefinition[]) {
  if (locale === "en") {
    return definitions;
  }

  const labels: Record<string, string> = {
    "footer.brandName": "页脚品牌名",
    "footer.copyright": "版权声明",
    "record.icp": "ICP备案号",
    "record.icpUrl": "ICP备案链接",
    "record.police": "公安备案号",
    "record.policeUrl": "公安备案链接",
    "contact.showOnHome": "首页显示联系方式悬浮框"
  };

  return definitions.map((definition) => ({
    ...definition,
    label: labels[definition.key] ?? definition.label
  }));
}

export default async function AdminFooterSettingsPage() {
  const [locale, user, { settings, error }] = await Promise.all([
    getAdminLocale(),
    requireAdminAccess("/admin/settings/footer"),
    getSettingsMap()
  ]);

  if (!canManageSettings(user)) {
    return null;
  }

  const definitions = localizeFooterDefinitions(locale, getLocalizedSettingDefinitions(locale));
  const definitionMap = new Map(definitions.map((definition) => [definition.key, definition]));
  const pickDefinitions = (keys: string[]) =>
    keys.flatMap((key) => {
      const definition = definitionMap.get(key);
      return definition ? [definition] : [];
    });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={t(locale, "adminAppearance")}
        title={t(locale, "adminFooter")}
        description={
          locale === "en"
            ? "Manage footer brand text, filing links, and the public contact list shown across the site."
            : "管理页脚品牌、备案链接，以及全站统一展示的公开联系方式列表。"
        }
      />

      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}

      <SettingsForm
        locale={locale}
        settings={settings}
        groups={{
          [locale === "en" ? "Footer brand" : "页脚品牌"]: pickDefinitions([
            "footer.brandName",
            "footer.copyright"
          ]),
          [locale === "en" ? "Filing information" : "备案信息"]: pickDefinitions([
            "record.icp",
            "record.icpUrl",
            "record.police",
            "record.policeUrl"
          ]),
          [locale === "en" ? "Homepage contact card" : "首页联系方式悬浮框"]: pickDefinitions([
            "contact.showOnHome"
          ])
        }}
      />

      <ContactItemsForm locale={locale} initialItems={parseContactItems(settings)} />
    </div>
  );
}
