import { redirect } from "next/navigation";
import { HomepageAppearanceForm } from "@/components/admin/homepage-appearance-form";
import { Card } from "@/components/ui/card";
import { getSettingsMap } from "@/features/settings/service";
import { requireAdminAccess } from "@/lib/admin-guard";
import { getAdminLocale, t } from "@/lib/i18n";
import { canManageSettings } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminHomepageSettingsPage() {
  const [locale, user, { settings, error }] = await Promise.all([
    getAdminLocale(),
    requireAdminAccess("/admin/settings/homepage"),
    getSettingsMap()
  ]);

  if (!canManageSettings(user)) {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">{t(locale, "adminAppearance")}</p>
        <h1 className="text-3xl font-semibold">{t(locale, "adminHomeNavigation")}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          {locale === "en"
            ? "Manage the public background source, random fallback URL, readability overlay, blur, and theme colors in one organized panel."
            : "在同一个面板里管理前台背景来源、随机兜底地址、遮罩、磨砂和主题色。当前生效地址会直接显示在输入框中。"}
        </p>
      </div>
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      <HomepageAppearanceForm settings={settings} locale={locale} />
    </div>
  );
}
