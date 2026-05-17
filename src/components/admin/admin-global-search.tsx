"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/lib/i18n-messages";
import { cn } from "@/lib/utils";

export function AdminGlobalSearch({
  locale,
  defaultQuery = ""
}: {
  locale: Locale;
  defaultQuery?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultQuery);
  const [mobileOpen, setMobileOpen] = useState(false);
  const placeholder = locale === "en" ? "Search admin content..." : "搜索后台内容...";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    if (!normalized) {
      return;
    }
    router.push(`/admin/search?q=${encodeURIComponent(normalized)}`);
    setMobileOpen(false);
  }

  return (
    <div className="flex min-w-0 flex-1 justify-center px-3">
      <form onSubmit={submit} className="hidden w-full max-w-xl md:block">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            className="h-11 rounded-2xl bg-white/85 pl-10 shadow-sm backdrop-blur"
          />
        </label>
      </form>

      <div className="md:hidden">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-full border bg-white/90 text-muted-foreground shadow-sm transition hover:border-primary/40 hover:text-primary"
          onClick={() => setMobileOpen((current) => !current)}
          aria-label={locale === "en" ? "Open search" : "打开搜索"}
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </button>

        {mobileOpen ? (
          <form
            onSubmit={submit}
            className="fixed left-4 right-4 top-20 z-[85] rounded-2xl border bg-white/96 p-3 shadow-2xl shadow-slate-950/15 backdrop-blur-xl"
          >
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={placeholder}
                autoFocus
                className={cn("h-11 rounded-xl pl-10")}
              />
            </label>
          </form>
        ) : null}
      </div>
    </div>
  );
}
