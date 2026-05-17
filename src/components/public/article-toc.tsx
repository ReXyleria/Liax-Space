"use client";

import { ChevronLeft, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type TocItem = {
  id: string;
  title: string;
  level: 1 | 2 | 3 | 4;
};

export function ArticleToc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!items.length) {
      return;
    }

    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

        if (visible?.target.id) {
          setActiveId(visible.target.id);
        }
      },
      { rootMargin: "-18% 0px -70% 0px", threshold: [0, 1] }
    );

    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [items]);

  if (!items.length) {
    return null;
  }

  function navigateTo(item: TocItem) {
    const target = document.getElementById(item.id);
    if (!target) {
      return;
    }
    const offset = 96;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${item.id}`);
    setActiveId(item.id);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="fixed right-0 top-1/2 z-[70] grid h-14 w-8 -translate-y-1/2 place-items-center rounded-l-full border border-r-0 border-white/80 bg-white/80 text-muted-foreground shadow-soft backdrop-blur-xl transition hover:w-10 hover:bg-white/95 hover:text-primary"
        onClick={() => setOpen(true)}
        aria-label="打开目录"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[90]">
          <button
            type="button"
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
            aria-label="关闭目录"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute right-0 top-0 flex h-full w-80 max-w-[86vw] flex-col border-l border-white/80 bg-white/95 p-5 shadow-2xl shadow-slate-950/15 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">目录</p>
                <p className="mt-1 text-xs text-muted-foreground">点击标题定位到正文位置</p>
              </div>
              <button
                type="button"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-white transition hover:bg-muted"
                onClick={() => setOpen(false)}
                aria-label="关闭目录"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item)}
                  className={cn(
                    "block w-full rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
                    item.level === 2 && "pl-4",
                    item.level === 3 && "pl-6 text-xs",
                    item.level === 4 && "pl-8 text-xs",
                    activeId === item.id && "bg-primary/10 text-primary"
                  )}
                >
                  <span className="mr-2 text-[10px] font-semibold text-muted-foreground">H{item.level}</span>
                  {item.title}
                </button>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
