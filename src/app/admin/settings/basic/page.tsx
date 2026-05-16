import { SettingsSectionPage } from "@/components/admin/settings-section-page";
import { getAdminLocale, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AdminBasicSettingsPage() {
  const locale = await getAdminLocale();

  return (
    <SettingsSectionPage
      path="/admin/settings/basic"
      locale={locale}
      eyebrow={t(locale, "adminSystem")}
      title={t(locale, "adminBasicSettings")}
      description={
        locale === "en"
          ? "Manage the site title, subtitle, domain, logo, theme colors, and registration entry. Homepage owner information is resolved automatically from Administer or ADMIN accounts."
          : "管理站点标题、副标题、域名、Logo、主题色和注册入口。首页站主信息会自动从 Administer 或 ADMIN 账户中解析。"
      }
      emptyText={t(locale, "settingsMissingDefinitions")}
      settingKeys={["site.title", "site.subtitle", "site.url", "site.logo", "register.enabled"]}
    />
  );
}
