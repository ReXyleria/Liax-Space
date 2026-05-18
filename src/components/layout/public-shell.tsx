import Link from "next/link";
import { UserRole } from "@prisma/client";
import { VisitTracker } from "@/components/analytics/visit-tracker";
import { CodeInjectionRenderer } from "@/components/layout/code-injection-renderer";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { MobilePublicNav } from "@/components/layout/mobile-public-nav";
import { PublicHeaderFrame } from "@/components/layout/public-header-frame";
import { PublicSearch } from "@/components/layout/public-search";
import { SiteBackground, resolveSiteBackground } from "@/components/layout/site-background";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getCodeInjectionMap, getEnabledCodeInjection } from "@/features/code-injection/service";
import { getFooterBrandName, getFooterCopyright } from "@/features/settings/footer";
import { getSettingsMap } from "@/features/settings/service";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getCurrentLocale } from "@/lib/i18n-server";
import type { Locale } from "@/lib/i18n-messages";
import { localizedPath } from "@/lib/locale-url";
import { cn } from "@/lib/utils";

function getProfileHref(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) {
    return "/login";
  }

  if (user.role === UserRole.Administer) {
    return "/admin";
  }

  return "/admin/account";
}

function FilingLink({
  label,
  href,
  transparent
}: {
  label: string;
  href: string;
  transparent?: boolean;
}) {
  if (!label) {
    return null;
  }

  return (
    <a
      className={cn(
        "underline-offset-4 hover:underline",
        transparent ? "hover:text-white" : "hover:text-foreground"
      )}
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {label}
    </a>
  );
}

export async function PublicShell({
  children,
  transparentHeader = false,
  homePage = false,
  locale,
  autoHideHeader = false
}: {
  children: React.ReactNode;
  transparentHeader?: boolean;
  homePage?: boolean;
  locale?: Locale;
  autoHideHeader?: boolean;
}) {
  const [{ settings }, { settings: codeInjection }, user, resolvedLocale] = await Promise.all([
    getSettingsMap(),
    getCodeInjectionMap(),
    getCurrentUser(),
    locale ? Promise.resolve(locale) : getCurrentLocale()
  ]);

  const profileHref = getProfileHref(user);
  const displayName = user?.nickname ?? t(resolvedLocale, "login");
  const displayAvatar = user?.avatar;
  const icp = settings["record.icp"];
  const police = settings["record.police"];
  const siteTitle = settings["site.title"] || "Liax-Space";
  const footerBrandName = getFooterBrandName(settings);
  const footerCopyright = getFooterCopyright(settings);
  const siteMark = siteTitle.trim().slice(0, 2).toUpperCase() || "PB";
  const sharedBackground = resolveSiteBackground(settings);
  const navItems = [
    { href: localizedPath(resolvedLocale), label: t(resolvedLocale, "home") },
    { href: localizedPath(resolvedLocale, "/articles"), label: t(resolvedLocale, "articles") },
    { href: localizedPath(resolvedLocale, "/tags"), label: t(resolvedLocale, "tags") },
    { href: localizedPath(resolvedLocale, "/moments"), label: t(resolvedLocale, "moments") },
    { href: localizedPath(resolvedLocale, "/guestbook"), label: t(resolvedLocale, "guestbook") },
    { href: localizedPath(resolvedLocale, "/archives"), label: t(resolvedLocale, "archives") }
  ];
  const footerInjectionEnabled = getEnabledCodeInjection(codeInjection, "code.globalFooter");

  return (
    <div className={cn("relative isolate flex flex-col", homePage ? "h-screen overflow-hidden" : "min-h-screen")}>
      <VisitTracker />
      <SiteBackground src={sharedBackground} variant={homePage ? "home" : "frosted"} />

      <PublicHeaderFrame transparentHeader={transparentHeader} autoHideOnScroll={autoHideHeader}>
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <MobilePublicNav
            navItems={navItems}
            locale={resolvedLocale}
            profileHref={profileHref}
            displayName={displayName}
            displayAvatar={displayAvatar}
            siteTitle={siteTitle}
            siteLogo={settings["site.logo"]?.trim()}
            siteMark={siteMark}
          />

          <Link href={localizedPath(resolvedLocale)} className="flex min-w-0 items-center gap-3 text-base font-semibold">
            <span
              className={cn(
                "grid h-9 w-9 place-items-center overflow-hidden rounded-lg text-sm shadow-sm",
                transparentHeader
                  ? "bg-white/16 text-white"
                  : "bg-gradient-to-br from-blue-200 to-purple-200 text-primary"
              )}
              style={
                settings["site.logo"]
                  ? {
                      backgroundImage: `url(${settings["site.logo"]})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }
                  : undefined
              }
            >
              {settings["site.logo"] ? null : siteMark}
            </span>
            <span className="truncate">{siteTitle}</span>
          </Link>

          <nav
            className={cn(
              "flex items-center gap-4 text-sm",
              transparentHeader ? "text-white/82" : "text-muted-foreground"
            )}
          >
            <div className="hidden items-center gap-4 md:flex">
              <LanguageSwitcher locale={resolvedLocale} transparent={transparentHeader} />
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  className={cn("hover:text-foreground", transparentHeader && "hover:text-white")}
                  href={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <PublicSearch locale={resolvedLocale} transparent={transparentHeader} />
            <Link
              className={cn(
                "inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 shadow-sm",
                transparentHeader
                  ? "border-white/20 bg-white/12 text-white hover:border-white/45 hover:bg-white/18"
                  : "bg-card/80 text-foreground hover:border-primary/40"
              )}
              href={profileHref}
            >
              <UserAvatar
                src={displayAvatar}
                name={displayName}
                className={cn(
                  "h-7 w-7 text-xs",
                  transparentHeader ? "bg-white/18 text-white" : "bg-primary/10 text-primary"
                )}
              />
              <span>{displayName}</span>
            </Link>
          </nav>
        </div>
      </PublicHeaderFrame>

      <div className={cn("flex-1", homePage && "min-h-0")}>{children}</div>

      <footer
        className={cn(
          "border-t",
          homePage
            ? "absolute bottom-0 left-0 right-0 z-20 border-white/10 bg-transparent text-white"
            : "border-white/70 bg-background/70"
        )}
      >
        <div
          className={cn(
            "mx-auto flex max-w-6xl flex-col gap-5 px-6 text-sm",
            homePage ? "py-4 text-white/80" : "py-8 text-muted-foreground"
          )}
        >
          {footerInjectionEnabled ? (
            <CodeInjectionRenderer
              articleHead=""
              globalFooter={getEnabledCodeInjection(codeInjection, "code.globalFooter")}
              mode="footer"
            />
          ) : null}

          <div
            className={cn(
              "flex flex-col gap-2 border-t pt-5 md:flex-row md:items-center md:justify-between",
              homePage ? "border-white/12 text-white/84" : "border-white/70"
            )}
          >
            <span>{footerCopyright || footerBrandName}</span>
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              {icp || police ? (
                <>
                  <FilingLink
                    label={icp}
                    href={settings["record.icpUrl"] || "https://beian.miit.gov.cn/"}
                    transparent={homePage}
                  />
                  <FilingLink
                    label={police}
                    href={settings["record.policeUrl"] || "https://www.beian.gov.cn/portal/registerSystemInfo"}
                    transparent={homePage}
                  />
                </>
              ) : (
                resolvedLocale === "en" ? "Filing information not configured yet." : "备案信息待配置。"
              )}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
