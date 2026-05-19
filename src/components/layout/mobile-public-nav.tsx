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
      <button
        type="button"
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-5 z-[160] grid h-12 w-12 place-items-center rounded-full border border-white/95 bg-white text-foreground shadow-2xl shadow-slate-950/15 transition-all duration-500 ease-out hover:-translate-y-0.5 hover:border-primary/35 hover:text-primary active:translate-y-0 active:scale-95 md:hidden"
        onClick={() => setOpen(true)}
        aria-label={openLabel}
        aria-expanded={open}
      >
        <Menu className="h-5 w-5" />
      </button>

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
            "absolute bottom-0 left-0 top-0 flex w-[min(21rem,86vw)] flex-col border-r border-slate-200/80 bg-white px-5 py-5 shadow-2xl shadow-slate-950/14 transition-transform duration-700 ease-out",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 text-sm font-semibold text-primary shadow-sm ring-1 ring-slate-200/80"
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
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-muted-foreground transition duration-300 hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              onClick={() => setOpen(false)}
              aria-label={closeLabel}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="mt-6 grid gap-2">
            {navItems.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg border border-slate-200/75 bg-white px-4 py-3 text-sm font-medium shadow-sm shadow-slate-950/5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 active:translate-y-0 active:scale-[0.99]"
                onClick={() => setOpen(false)}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                  {index === 0 ? <Home className="h-4 w-4" /> : <span className="text-xs font-semibold">{index + 1}</span>}
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-6 border-t border-slate-200/75 pt-5">
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">{languageTitle}</p>
            <LanguageSwitcher locale={locale} />
          </div>

          <Link
            href={profileHref}
            onClick={() => setOpen(false)}
            className="mt-auto flex items-center gap-3 rounded-lg border border-slate-200/75 bg-white p-3 text-sm font-medium shadow-sm shadow-slate-950/5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 active:translate-y-0 active:scale-[0.99]"
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
