import { ConsoleShell } from "@/components/console/console-shell";
import { resolveSiteBackground } from "@/components/layout/site-background";
import { getSettingsMap } from "@/features/settings/service";
import { requireConsoleAccess } from "@/lib/console-guard";
import { getConsoleLocale } from "@/lib/i18n-server";
import { getSiteTitle } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const [user, locale, siteTitle, { settings }] = await Promise.all([
    requireConsoleAccess("/console"),
    getConsoleLocale(),
    getSiteTitle(),
    getSettingsMap()
  ]);

  const siteLogo = settings["site.logo"]?.trim();

  return (
    <ConsoleShell
      user={user}
      locale={locale}
      siteTitle={siteTitle}
      siteLogo={siteLogo}
      backgroundImage={resolveSiteBackground(settings)}
    >
      {children}
    </ConsoleShell>
  );
}
