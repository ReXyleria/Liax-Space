"use client";

import type { BlockCommand, EditorTexts } from "./editor-types";

export function BlockInsertMenu({
  commands,
  texts,
  x,
  y,
  open,
  onRun
}: {
  commands: BlockCommand[];
  texts: EditorTexts;
  x: number;
  y: number;
  open: boolean;
  onRun: (index: number) => void;
}) {
  if (!open) {
    return null;
  }

  const viewportWidth = typeof window === "undefined" ? 1200 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 900 : window.innerHeight;
  const top = y + 320 > viewportHeight ? y - 320 : y;

  return (
    <div
      className="fixed z-[120] w-72 rounded-xl border bg-card p-1 shadow-2xl shadow-primary/10"
      style={{ left: Math.min(x, viewportWidth - 300), top: Math.max(12, top) }}
    >
      <p className="px-3 py-2 text-xs font-medium text-muted-foreground">{texts.insertBlock}</p>
      <div className="max-h-72 overflow-auto">
        {commands.map((command, index) => (
          <button
            key={command.key}
            type="button"
            className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-muted"
            onMouseDown={(event) => {
              event.preventDefault();
              onRun(index);
            }}
          >
            <span>
              <span className="block font-medium">{command.label}</span>
              <span className="block text-xs text-muted-foreground">{command.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
