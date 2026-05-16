import Link from "next/link";
import { UserRole } from "@prisma/client";
import { VisitTracker } from "@/components/analytics/visit-tracker";
import { CodeInjectionRenderer } from "@/components/layout/code-injection-renderer";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { SiteBackground, resolveSiteBackground } from "@/components/layout/site-background";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getCodeInjectionMap, getEnabledCodeInjection } from "@/features/code-injection/service";
import { getSettingsMap } from "@/features/settings/service";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLocale, t } from "@/lib/i18n";
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
  homePage = false
}: {
  children: React.ReactNode;
  transparentHeader?: boolean;
  homePage?: boolean;
}) {
  const [{ settings }, { settings: codeInjection }, user, locale] = await Promise.all([
    getSettingsMap(),
    getCodeInjectionMap(),
    getCurrentUser(),
    getCurrentLocale()
  ]);

  const profileHref = getProfileHref(user);
  const displayName = user?.nickname ?? t(locale, "login");
  const displayAvatar = user?.avatar;
  const icp = settings["record.icp"];
  const police = settings["record.police"];
  const siteTitle = settings["site.title"] || "Liax-Space";
  const siteMark = siteTitle.trim().slice(0, 2).toUpperCase() || "PB";
  const sharedBackground = resolveSiteBackground(settings);
  const navItems = [
    { href: "/", label: t(locale, "home") },
    { href: "/articles", label: t(locale, "articles") },
    { href: "/tags", label: t(locale, "tags") },
    { href: "/moments", label: t(locale, "moments") },
    { href: "/archives", label: t(locale, "archives") }
  ];
  const footerInjectionEnabled =
    getEnabledCodeInjection(codeInjection, "code.globalFooter") ||
    getEnabledCodeInjection(codeInjection, "code.customHtml") ||
    getEnabledCodeInjection(codeInjection, "code.customCss") ||
    getEnabledCodeInjection(codeInjection, "code.customJs");

  return (
    <div className={cn("relative isolate flex flex-col", homePage ? "h-screen overflow-hidden" : "min-h-screen")}>
      <VisitTracker />
      <SiteBackground src={sharedBackground} variant={homePage ? "home" : "frosted"} />

      <header
        className={cn(
          "top-0 z-30 w-full border-b backdrop-blur-xl",
          transparentHeader ? "fixed border-white/10 bg-transparent text-white" : "sticky border-white/70 bg-background/72"
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 text-base font-semibold">
            <span
              className={cn(
                "grid h-9 w-9 place-items-center overflow-hidden rounded-lg text-sm shadow-sm",
                transparentHeader
                  ? "bg-white/16 text-white ring-1 ring-white/24"
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
            <span>{siteTitle}</span>
          </Link>

          <nav
            className={cn(
              "flex items-center gap-4 text-sm",
              transparentHeader ? "text-white/82" : "text-muted-foreground"
            )}
          >
            <LanguageSwitcher locale={locale} transparent={transparentHeader} />
            {navItems.map((item) => (
              <Link
                key={item.href}
                className={cn("hover:text-foreground", transparentHeader && "hover:text-white")}
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
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
      </header>

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
              globalHead=""
              articleHead=""
              globalFooter={getEnabledCodeInjection(codeInjection, "code.globalFooter")}
              customHtml={getEnabledCodeInjection(codeInjection, "code.customHtml")}
              customCss={getEnabledCodeInjection(codeInjection, "code.customCss")}
              customJs={getEnabledCodeInjection(codeInjection, "code.customJs")}
              mode="footer"
            />
          ) : null}

          <div
            className={cn(
              "flex flex-col gap-2 border-t pt-5 md:flex-row md:items-center md:justify-between",
              homePage ? "border-white/12 text-white/84" : "border-white/70"
            )}
          >
            <span>&copy; {new Date().getFullYear()} {siteTitle}. All rights reserved.</span>
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
                locale === "en" ? "Filing information not configured yet." : "备案信息待配置。"
              )}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
