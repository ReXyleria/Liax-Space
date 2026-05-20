import { ConsolePageHeader } from "@/components/console/console-page-header";
import { FooterSettingsForm } from "@/components/console/footer-settings-form";
import { Card } from "@/components/ui/card";
import { parseContactItems } from "@/features/settings/contact-items";
import { getSettingsMap } from "@/features/settings/service";
import { requireConsoleAccess } from "@/lib/console-guard";
import { t } from "@/lib/i18n";
import { getConsoleLocale } from "@/lib/i18n-server";
import { canManageSettings } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ConsoleFooterSettingsPage() {
  const [locale, user, { settings, error }] = await Promise.all([
    getConsoleLocale(),
    requireConsoleAccess("/console/settings/footer"),
    getSettingsMap()
  ]);

  if (!canManageSettings(user)) {
    return null;
  }

  return (
    <div className="space-y-6">
      <ConsolePageHeader
        eyebrow={t(locale, "consoleAppearance")}
        title={t(locale, "consoleFooter")}
        description={
          locale === "en"
            ? "Manage footer brand text, filing links, and homepage contact display in one place."
            : "统一管理页脚品牌、备案链接、首页联系方式悬浮窗和联系方式列表。"
        }
      />

      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}

      <FooterSettingsForm locale={locale} settings={settings} initialItems={parseContactItems(settings)} />
    </div>
  );
}
