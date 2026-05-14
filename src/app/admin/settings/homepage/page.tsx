import { SettingsSectionPage } from "@/components/admin/settings-section-page";
import { getAdminLocale, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AdminHomepageSettingsPage() {
  const locale = await getAdminLocale();

  return (
    <SettingsSectionPage
      path="/admin/settings/homepage"
      locale={locale}
      eyebrow={t(locale, "adminAppearance")}
      title={t(locale, "adminHomeNavigation")}
      description={
        locale === "en"
          ? "Manage the shared background, frosted overlay, theme colors, and homepage visuals. The hero headline is read from the site subtitle in basic settings."
          : "管理全站背景、磨砂遮罩、主题色和首页视觉。首页主标题会读取基础设置中的站点副标题。"
      }
      emptyText={t(locale, "settingsMissingDefinitions")}
      settingKeys={[
        "appearance.backgroundImage",
        "appearance.backgroundOverlayOpacity",
        "appearance.backgroundBlur",
        "theme.primary",
        "theme.accent",
        "home.cover"
      ]}
    />
  );
}
