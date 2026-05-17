"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import type { Locale } from "@/lib/i18n-messages";
import { cn } from "@/lib/utils";

function placeholder(locale: Locale) {
  return locale === "en" ? "Search articles" : "搜索文章";
}

export function PublicSearch({
  locale,
  transparent
}: {
  locale: Locale;
  transparent?: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    router.push(normalized ? `/articles?q=${encodeURIComponent(normalized)}` : "/articles");
    setExpanded(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          "grid h-9 w-9 place-items-center rounded-full border transition md:hidden",
          transparent
            ? "border-white/20 bg-white/12 text-white hover:bg-white/18"
            : "bg-card/80 text-foreground hover:border-primary/40"
        )}
        aria-label={placeholder(locale)}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
      </button>

      <form
        action="/articles"
        className={cn(
          "hidden items-center rounded-full border px-3 transition md:flex",
          transparent
            ? "border-white/20 bg-white/12 text-white focus-within:border-white/45"
            : "bg-card/80 text-foreground focus-within:border-primary/40"
        )}
        onSubmit={submit}
      >
        <Search className={cn("mr-2 h-4 w-4", transparent ? "text-white/75" : "text-muted-foreground")} />
        <input
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder(locale)}
          className={cn(
            "h-9 w-44 bg-transparent text-sm outline-none placeholder:text-current/55",
            transparent ? "text-white" : "text-foreground"
          )}
        />
      </form>

      {expanded ? (
        <form
          action="/articles"
          className={cn(
            "absolute right-0 top-11 z-40 flex w-[min(18rem,calc(100vw-2rem))] items-center rounded-full border px-3 shadow-xl md:hidden",
            transparent
              ? "border-white/20 bg-slate-950/55 text-white backdrop-blur-xl"
              : "border-white/70 bg-white/96 text-foreground backdrop-blur-xl"
          )}
          onSubmit={submit}
        >
          <Search className={cn("mr-2 h-4 w-4", transparent ? "text-white/75" : "text-muted-foreground")} />
          <input
            name="q"
            value={query}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder(locale)}
            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-current/55"
          />
        </form>
      ) : null}
    </div>
  );
}
