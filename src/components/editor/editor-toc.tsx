"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import type { EditorTocItem } from "@/components/editor/block-editor/editor-types";
import { cn } from "@/lib/utils";

export function EditorToc() {
  const [items, setItems] = useState<EditorTocItem[]>([]);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const updateItems = (event: Event) => {
      const nextItems = (event as CustomEvent<{ items?: EditorTocItem[] }>).detail?.items ?? [];
      setItems(nextItems);
      setActiveId((current) => current || nextItems[0]?.id || "");
    };
    const updateActive = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id ?? "";
      setActiveId(id);
    };

    window.addEventListener("editor-toc:update", updateItems);
    window.addEventListener("editor-toc:active", updateActive);
    window.dispatchEvent(new Event("editor-toc:request"));
    return () => {
      window.removeEventListener("editor-toc:update", updateItems);
      window.removeEventListener("editor-toc:active", updateActive);
    };
  }, []);

  return (
    <Card className="sticky top-24 p-4 text-sm">
      <details open>
        <summary className="cursor-pointer select-none font-medium">标题目录</summary>
        {items.length ? (
          <nav className="mt-3 space-y-1">
            {items.map((item) => (
              <button
                key={`${item.id}-${item.pos}`}
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("editor-toc:navigate", { detail: item }));
                  setActiveId(item.id);
                }}
                className={cn(
                  "block w-full rounded-md px-2 py-1.5 text-left text-muted-foreground hover:bg-muted hover:text-foreground",
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
        ) : (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            正文中添加 H1-H4 标题后会自动生成目录。
          </p>
        )}
      </details>
    </Card>
  );
}
