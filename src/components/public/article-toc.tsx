"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type TocItem = {
  id: string;
  title: string;
  level: 1 | 2 | 3 | 4;
};

export function ArticleToc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

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

  return (
    <aside className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-auto rounded-lg border bg-card/78 p-4 text-sm shadow-soft backdrop-blur lg:block">
      <p className="mb-3 font-medium">目录</p>
      <nav className="space-y-1">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            onClick={(event) => {
              event.preventDefault();
              const target = document.getElementById(item.id);
              if (!target) {
                return;
              }
              const offset = 96;
              const top = target.getBoundingClientRect().top + window.scrollY - offset;
              window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
              window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${item.id}`);
              setActiveId(item.id);
            }}
            className={cn(
              "block rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground",
              item.level === 2 && "pl-4",
              item.level === 3 && "pl-6 text-xs",
              item.level === 4 && "pl-8 text-xs",
              activeId === item.id && "bg-primary/10 text-primary"
            )}
          >
            <span className="mr-2 text-[10px] font-semibold text-muted-foreground">H{item.level}</span>
            {item.title}
          </a>
        ))}
      </nav>
    </aside>
  );
}
