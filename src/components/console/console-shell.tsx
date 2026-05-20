"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { consoleSidebarGroups, type ConsoleTabItem } from "@/config/console-nav";
import { LogoutButton } from "@/components/console/logout-button";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { SiteBackground } from "@/components/layout/site-background";
import { UserAvatar } from "@/components/ui/user-avatar";
import { iconMap } from "@/components/console/console-nav-link";
import type { CurrentUser } from "@/lib/auth";
import type { Locale } from "@/lib/i18n-messages";
import { t } from "@/lib/i18n-messages";
import {
  canManageArticles,
  canManageBackups,
  canManageCodeInjection,
  canManageComments,
  canManageGuestbook,
  canManageIdentities,
  canManageMailTemplates,
  canManageMoments,
  canManageSettings,
  canManageUsers,
  canViewAnalytics
} from "@/lib/permissions";
import { roleLabels } from "@/lib/role-labels";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Menu, X } from "lucide-react";

function canSeeTab(tab: ConsoleTabItem, user: CurrentUser) {
  switch (tab.visibility) {
    case "always":
      return true;
    case "analytics":
      return canViewAnalytics(user);
    case "articles":
      return canManageArticles(user);
    case "moments":
      return canManageMoments(user);
    case "comments":
      return canManageComments(user);
    case "guestbook":
      return canManageGuestbook(user);
    case "users":
      return canManageUsers(user);
    case "identities":
      return canManageIdentities(user);
    case "settings":
      return canManageSettings(user);
    case "codeInjection":
      return canManageCodeInjection(user);
    case "mailTemplates":
      return canManageMailTemplates(user);
    case "backups":
      return canManageBackups(user);
    default:
      return false;
  }
}

export function ConsoleShell({
  user,
  locale,
  siteTitle,
  siteLogo,
  backgroundImage,
  children
}: {
  user: CurrentUser;
  locale: Locale;
  siteTitle: string;
  siteLogo?: string;
  backgroundImage?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Determine active sidebar group based on current path
  const activeGroup = consoleSidebarGroups.find((g) =>
    g.tabs.some((tab) => pathname === tab.href || (tab.href !== "/console" && pathname.startsWith(tab.href)))
  );

  // Visible tabs for active group
  const visibleTabs = activeGroup
    ? activeGroup.tabs.filter((tab) => canSeeTab(tab, user))
    : [];

  // Filter visible sidebar groups
  const visibleGroups = consoleSidebarGroups.filter((g) =>
    g.tabs.some((tab) => canSeeTab(tab, user))
  );

  return (
    <div className="relative isolate min-h-screen">
      <SiteBackground src={backgroundImage} variant="frosted" />
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-[900] md:hidden">
          <button
            type="button"
            aria-label="Close console navigation"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-[min(20rem,86vw)] flex-col overflow-hidden border-r border-white/80 bg-white/96 px-4 py-4 shadow-2xl shadow-slate-950/20 backdrop-blur-xl">
            <div className="mb-4 flex items-center gap-3">
              <Link
                href="/"
                onClick={() => setMobileNavOpen(false)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-background/70 p-2 transition hover:shadow-md"
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent bg-cover bg-center text-sm font-semibold text-primary-foreground"
                  style={siteLogo ? { backgroundImage: `url(${siteLogo})` } : undefined}
                >
                  {siteLogo ? null : (siteTitle.trim().slice(0, 2) || "SB").toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{siteTitle}</span>
                  <span className="block text-xs text-muted-foreground">{t(locale, "consoleConsole")}</span>
                </span>
              </Link>
              <button
                type="button"
                aria-label="Close console navigation"
                onClick={() => setMobileNavOpen(false)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-background/80 text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {visibleGroups.map((group) => {
                const isActive = activeGroup?.key === group.key;
                const Icon = iconMap[group.iconKey];
                const groupHref = group.tabs.find((tab) => canSeeTab(tab, user))?.href ?? "/console";

                return (
                  <Link
                    key={group.key}
                    href={groupHref}
                    onClick={() => setMobileNavOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-2 py-2.5 text-sm transition-all duration-200 hover:border-primary/30 hover:bg-background/80 hover:text-foreground hover:shadow-sm active:scale-[0.99]",
                      isActive
                        ? "border-primary/35 bg-primary/10 text-foreground shadow-sm"
                        : "border-transparent text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-md transition-all",
                        isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="truncate font-medium">{t(locale, group.labelKey)}</span>
                  </Link>
                );
              })}
            </nav>

            <Link
              href="/console/account?section=profile"
              onClick={() => setMobileNavOpen(false)}
              className="mt-3 flex items-center gap-3 rounded-lg border border-white/70 bg-background/70 p-2 transition hover:border-primary/40 hover:shadow-md"
            >
              <UserAvatar
                src={user.avatar}
                name={user.nickname}
                className="h-9 w-9 shrink-0 bg-gradient-to-br from-primary to-accent text-primary-foreground"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{user.nickname}</span>
                <span className="block text-xs text-muted-foreground">{roleLabels[user.role]}</span>
              </span>
            </Link>
          </aside>
        </div>
      ) : null}
      {/* Left Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden h-screen flex-col overflow-hidden border-r border-white/70 bg-card/90 px-3 py-4 shadow-soft backdrop-blur-xl transition-all duration-200 md:flex",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Brand */}
        <Link
          href="/"
          className={cn(
            "mb-4 flex items-center gap-3 rounded-lg bg-background/70 p-2 transition hover:-translate-y-0.5 hover:shadow-md",
            collapsed && "justify-center"
          )}
        >
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-sm font-semibold text-primary-foreground bg-cover bg-center"
            style={
              siteLogo
                ? { backgroundImage: `url(${siteLogo})` }
                : undefined
            }
          >
            {siteLogo ? null : (siteTitle.trim().slice(0, 2) || "SB").toUpperCase()}
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block text-sm font-semibold truncate">{siteTitle}</span>
              <span className="block text-xs text-muted-foreground">{t(locale, "consoleConsole")}</span>
            </span>
          )}
        </Link>

        {/* Sidebar Groups */}
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {visibleGroups.map((group) => {
            const isActive = activeGroup?.key === group.key;
            const Icon = iconMap[group.iconKey];
            const groupHref = group.tabs.find((tab) => canSeeTab(tab, user))?.href ?? "/console";

            return (
              <Link
                key={group.key}
                href={groupHref}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-2 py-2.5 text-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background/80 hover:text-foreground hover:shadow-sm active:translate-y-0 active:scale-[0.99]",
                  collapsed ? "justify-center" : "",
                  isActive
                    ? "border-primary/35 bg-primary/10 text-foreground shadow-sm"
                    : "border-transparent text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-md transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {!collapsed && (
                  <span className="font-medium truncate">{t(locale, group.labelKey)}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="mt-3 flex items-center justify-center rounded-lg border border-transparent p-2 text-muted-foreground transition hover:border-border hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>

        {/* User footer */}
        <Link
          href="/console/account?section=profile"
          className={cn(
            "mt-2 flex items-center gap-3 rounded-lg border border-white/70 bg-background/70 p-2 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
            collapsed && "justify-center"
          )}
        >
          <UserAvatar
            src={user.avatar}
            name={user.nickname}
            className="h-9 w-9 shrink-0 bg-gradient-to-br from-primary to-accent text-primary-foreground"
          />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{user.nickname}</span>
              <span className="block text-xs text-muted-foreground">{roleLabels[user.role]}</span>
            </span>
          )}
        </Link>
      </aside>

      {/* Main Content Area */}
      <div className={cn("relative z-0 transition-all duration-200", collapsed ? "md:pl-16" : "md:pl-56")}>
        {/* Top Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/70 bg-background/85 px-6 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open console navigation"
              onClick={() => setMobileNavOpen(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-background/80 text-muted-foreground transition hover:border-primary/30 hover:text-foreground md:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <UserAvatar src={user.avatar} name={user.nickname} className="h-10 w-10" />
            <div className="hidden min-w-0 sm:block">
              <p className="text-sm text-muted-foreground">{t(locale, "consoleSignedInAs")}</p>
              <p className="truncate font-medium">{user.nickname}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <LanguageSwitcher locale={locale} />
            <LogoutButton />
          </div>
        </header>

        {/* Tabs Bar */}
        {visibleTabs.length > 1 && (
          <div className="sticky top-16 z-30 border-b border-white/60 bg-card/90 px-6 backdrop-blur-lg">
            <div className="flex gap-0 overflow-x-auto">
              {visibleTabs.map((tab) => {
                const isActive =
                  pathname === tab.href ||
                  (tab.href === "/console" && pathname === "/console") ||
                  (tab.href !== "/console" && pathname.startsWith(tab.href + "/")) ||
                  (tab.href !== "/console" && pathname === tab.href);
                const TabIcon = iconMap[tab.iconKey];

                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap",
                      isActive
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
                    )}
                  >
                    <TabIcon className="h-4 w-4" />
                    {t(locale, tab.labelKey)}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
