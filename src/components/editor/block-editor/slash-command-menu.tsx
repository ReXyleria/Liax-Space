"use client";

import { useEffect, useRef } from "react";
import type { BlockCommand, EditorTexts, SlashMenuState } from "./editor-types";

export function filterCommands(commands: BlockCommand[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return commands;
  }

  return commands.filter((command) => {
    const haystack = [command.label, command.description, ...command.keywords].join(" ").toLowerCase();
    return haystack.includes(normalized);
  });
}

export function SlashCommandMenu({
  commands,
  menu,
  texts,
  onHover,
  onRun
}: {
  commands: BlockCommand[];
  menu: SlashMenuState;
  texts: EditorTexts;
  onHover: (index: number) => void;
  onRun: (index: number) => void;
}) {
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [menu.selected, menu.open, commands.length]);

  if (!menu.open) {
    return null;
  }

  return (
    <div
      data-slash-menu
      className="absolute z-[80] w-72 overflow-hidden rounded-xl border bg-card shadow-2xl shadow-primary/10"
      style={{ left: menu.x, top: menu.y }}
      role="listbox"
      aria-label={texts.searchBlocks}
    >
      <div className="border-b px-3 py-2 text-xs text-muted-foreground">
        {texts.searchBlocks}{menu.query ? `: ${menu.query}` : ""}
      </div>
      <div className="max-h-72 overflow-y-auto overscroll-contain p-1">
        {commands.length ? (
          commands.map((command, index) => (
            <button
              key={command.key}
              ref={index === menu.selected ? activeItemRef : null}
              type="button"
              role="option"
              aria-selected={index === menu.selected}
              className={
                index === menu.selected
                  ? "flex w-full items-start justify-between gap-3 rounded-lg bg-primary/10 px-3 py-2 text-left text-sm text-primary"
                  : "flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
              }
              onMouseEnter={() => onHover(index)}
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
          ))
        ) : (
          <p className="px-3 py-4 text-sm text-muted-foreground">{texts.searchBlocks}</p>
        )}
      </div>
    </div>
  );
}
