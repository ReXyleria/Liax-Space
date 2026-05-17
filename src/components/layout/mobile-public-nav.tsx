"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useState } from "react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { Locale } from "@/lib/i18n-messages";
import { cn } from "@/lib/utils";

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
  siteMark,
  transparentHeader
}: {
  navItems: NavItem[];
  locale: Locale;
  profileHref: string;
  displayName: string;
  displayAvatar?: string | null;
  siteTitle: string;
  siteLogo?: string;
  siteMark: string;
  transparentHeader?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="flex min-w-0 items-center gap-3 text-left text-base font-semibold md:hidden"
        onClick={() => setOpen(true)}
        aria-label={locale === "en" ? "Open navigation" : "打开导航"}
      >
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg text-sm shadow-sm",
            transparentHeader ? "bg-white/16 text-white" : "bg-gradient-to-br from-blue-200 to-purple-200 text-primary"
          )}
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
        <span className="truncate">{siteTitle}</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/35 backdrop-blur-sm"
            aria-label={locale === "en" ? "Close navigation" : "关闭导航"}
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-80 max-w-[86vw] flex-col border-r border-white/70 bg-background/92 p-5 shadow-2xl backdrop-blur-xl">
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
                  <p className="text-xs text-muted-foreground">
                    {locale === "en" ? "Navigation" : "站点导航"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-background/80 transition hover:bg-muted"
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
                  className="rounded-lg border bg-card/80 px-4 py-3 text-sm font-medium transition hover:border-primary/40 hover:bg-primary/5"
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
              className="mt-auto flex items-center gap-3 rounded-lg border bg-card/80 p-3 text-sm font-medium transition hover:border-primary/40 hover:bg-primary/5"
            >
              <UserAvatar src={displayAvatar} name={displayName} className="h-9 w-9 text-xs" />
              <span className="min-w-0 truncate">{displayName}</span>
            </Link>
          </aside>
        </div>
      ) : null}
    </>
  );
}
