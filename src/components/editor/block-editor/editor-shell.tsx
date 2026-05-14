"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { EditorTexts } from "./editor-types";

export function EditorShell({
  children,
  texts,
  status = "idle"
}: {
  children: ReactNode;
  texts: EditorTexts;
  status?: "idle" | "saving" | "saved" | "unsaved";
}) {
  const statusLabel =
    status === "saving" ? texts.saving :
    status === "saved" ? texts.saved :
    status === "unsaved" ? texts.unsaved :
    texts.slashHint;

  return (
    <section className="w-full min-w-0">
      <div className="w-full min-w-0">
        {children}
      </div>
      <div
        className={cn(
          "mt-4 flex items-center justify-between px-0 text-xs text-muted-foreground",
          status === "unsaved" && "text-amber-600",
          status === "saved" && "text-emerald-600"
        )}
      >
        <span>{texts.slashHint}</span>
        <span>{statusLabel}</span>
      </div>
    </section>
  );
}
