"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
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

  return (
    <>
      <button
        type="button"
        className="fixed bottom-5 left-5 z-[80] grid h-12 w-12 place-items-center rounded-full border border-white/90 bg-white text-foreground shadow-2xl shadow-primary/20 transition duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:text-primary active:translate-y-0 active:scale-95 md:hidden"
        onClick={() => setOpen(true)}
        aria-label={locale === "en" ? "Open navigation" : "打开导航"}
      >
        <Menu className="h-5 w-5" />
      </button>

      <div
        className={cn(
          "fixed inset-0 z-[120] md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-0 bg-black/20 transition-opacity duration-500",
            open ? "opacity-100" : "opacity-0"
          )}
          aria-label={locale === "en" ? "Close navigation" : "关闭导航"}
          onClick={() => setOpen(false)}
        />
        <aside
          className={cn(
            "absolute left-0 top-0 flex h-full w-80 max-w-[86vw] flex-col border-r border-slate-200 bg-white p-5 shadow-2xl shadow-slate-950/15 transition-transform duration-500 ease-out",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-blue-200 to-purple-200 text-sm font-semibold text-primary shadow-sm"
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
                <p className="text-xs text-muted-foreground">{locale === "en" ? "Navigation" : "站点导航"}</p>
              </div>
            </div>
            <button
              type="button"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-white transition hover:bg-muted"
              onClick={() => setOpen(false)}
              aria-label={locale === "en" ? "Close navigation" : "关闭导航"}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="mt-6 grid gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border bg-white px-4 py-3 text-sm font-medium shadow-sm shadow-slate-950/5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 active:translate-y-0 active:scale-[0.99]"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-6 border-t pt-5">
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
              {locale === "en" ? "Language" : "语言"}
            </p>
            <LanguageSwitcher locale={locale} />
          </div>

          <Link
            href={profileHref}
            onClick={() => setOpen(false)}
            className="mt-auto flex items-center gap-3 rounded-lg border bg-white p-3 text-sm font-medium shadow-sm shadow-slate-950/5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 active:translate-y-0 active:scale-[0.99]"
          >
            <UserAvatar src={displayAvatar} name={displayName} className="h-9 w-9 text-xs" />
            <span className="min-w-0 truncate">{displayName}</span>
          </Link>
        </aside>
      </div>
    </>
  );
}
