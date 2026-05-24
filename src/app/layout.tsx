import type { Metadata } from "next";
import { RouteTransition } from "@/components/animations/route-transition";
import { CodeInjectionRenderer } from "@/components/layout/code-injection-renderer";
import { ServerHeadInjection } from "@/components/layout/server-head-injection";
import { getCodeInjectionMap, getEnabledCodeInjection } from "@/features/code-injection/service";
import { ensureScheduledBackupWorker } from "@/features/backup/scheduler";
import { getSettingsMap } from "@/features/settings/service";
import { getCurrentLocale } from "@/lib/i18n-server";
import { buildMetaDescription } from "@/lib/seo";
import { getMetadataBase, getSiteConfig } from "@/lib/site";
import { getThemeStyle } from "@/lib/theme";
import "../styles/globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const [site, { settings }, locale] = await Promise.all([
    getSiteConfig(),
    getSettingsMap(),
    getCurrentLocale()
  ]);
  const logo = settings["site.logo"]?.trim();

  return {
    metadataBase: await getMetadataBase(),
    title: {
      default: site.title,
      template: `%s - ${site.title}`
    },
    description: buildMetaDescription(site.subtitle, "A production-oriented Liax-Space publishing system.", locale),
    icons: logo ? { icon: logo, apple: logo } : undefined
  };
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  ensureScheduledBackupWorker();

  const [locale, { settings }, { settings: codeInjection }] = await Promise.all([
    getCurrentLocale(),
    getSettingsMap(),
    getCodeInjectionMap()
  ]);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body style={getThemeStyle(settings)}>
        <ServerHeadInjection />
        <RouteTransition>{children}</RouteTransition>
        <CodeInjectionRenderer
          articleHead={getEnabledCodeInjection(codeInjection, "code.articleHead")}
          globalFooter=""
          mode="head"
        />
      </body>
    </html>
  );
}
