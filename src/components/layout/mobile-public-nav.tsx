"use client";

import Link from "next/link";
import { Home, Menu, UserRound, X } from "lucide-react";
import { useState } from "react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n-messages";

type NavItem = {
  href: string;
  label: string;
};

export function MobilePublicNav({
  navItems,
  locale,
  profileHref,
  displayName,
  displayAvatar,
  siteTitle,
  siteLogo,
  siteMark
}: {
  navItems: NavItem[];
  locale: Locale;
  profileHref: string;
  displayName: string;
  displayAvatar?: string | null;
  siteTitle: string;
  siteLogo?: string;
  siteMark: string;
}) {
  const [open, setOpen] = useState(false);
  const openLabel = locale === "en" ? "Open navigation" : "打开导航";
  const closeLabel = locale === "en" ? "Close navigation" : "关闭导航";
  const navTitle = locale === "en" ? "Navigation" : "站点导航";
  const languageTitle = locale === "en" ? "Language" : "语言";

  return (
    <>
      <div className="relative z-[160] h-16 w-11 shrink-0 md:hidden">
        <button
          type="button"
          className="absolute left-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/95 bg-white text-foreground shadow-2xl shadow-slate-950/15 transition-all duration-500 ease-out hover:-translate-y-1/2 hover:border-primary/35 hover:text-primary active:translate-y-[calc(-50%+1px)] active:scale-95"
          onClick={() => setOpen(true)}
          aria-label={openLabel}
          aria-expanded={open}
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div
        className={cn(
          "fixed inset-0 z-[950] md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-slate-950/18 backdrop-blur-[2px] transition-opacity duration-700 ease-out",
            open ? "opacity-100" : "opacity-0"
          )}
          aria-label={closeLabel}
          onClick={() => setOpen(false)}
        />
        <aside
          className={cn(
            "absolute left-4 top-[max(4.75rem,calc(env(safe-area-inset-top)+4.75rem))] flex max-h-[min(34rem,calc(100dvh-7rem))] w-[min(21rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-slate-200/80 bg-white px-5 py-5 shadow-2xl shadow-slate-950/14 transition-all duration-700 ease-out",
            open ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-primary/15 to-accent/20 text-sm font-semibold text-primary shadow-sm ring-1 ring-primary/10"
                style={
                  siteLogo
                    ? {
                        backgroundImage: `url(${siteLogo})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center"
                      }
                    : undefined
                }
              >
                {siteLogo ? null : siteMark}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{siteTitle}</p>
                <p className="text-xs text-muted-foreground">{navTitle}</p>
              </div>
            </div>
            <button
              type="button"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-primary/10 bg-white text-muted-foreground transition duration-300 hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              onClick={() => setOpen(false)}
              aria-label={closeLabel}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="mt-6 grid min-h-0 gap-2 overflow-y-auto overscroll-contain pr-1">
            {navItems.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg border border-primary/10 bg-primary/5 px-4 py-3 text-sm font-medium text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/10 hover:text-primary active:translate-y-0 active:scale-[0.99]"
                onClick={() => setOpen(false)}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  {index === 0 ? <Home className="h-4 w-4" /> : <span className="text-xs font-semibold">{index + 1}</span>}
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-6 border-t border-primary/10 pt-5">
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">{languageTitle}</p>
            <LanguageSwitcher locale={locale} />
          </div>

          <Link
            href={profileHref}
            onClick={() => setOpen(false)}
            className="mt-6 flex items-center gap-3 rounded-lg border border-primary/10 bg-primary/5 p-3 text-sm font-medium text-muted-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-primary/10 hover:text-primary active:translate-y-0 active:scale-[0.99]"
          >
            <UserAvatar src={displayAvatar} name={displayName} className="h-9 w-9 text-xs" />
            <span className="min-w-0 flex-1 truncate">{displayName}</span>
            <UserRound className="h-4 w-4 text-muted-foreground" />
          </Link>
        </aside>
      </div>
    </>
  );
}
