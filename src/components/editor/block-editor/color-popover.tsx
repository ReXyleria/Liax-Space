"use client";

import type { Editor } from "@tiptap/react";
import { Highlighter, Palette } from "lucide-react";
import type { EditorTexts } from "./editor-types";

export function ColorPopover({
  editor,
  texts,
  type
}: {
  editor: Editor;
  texts: EditorTexts;
  type: "text" | "background";
}) {
  const label = type === "text" ? texts.textColor : texts.backgroundColor;
  const Icon = type === "text" ? Palette : Highlighter;

  return (
    <label
      className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md bg-muted px-2 text-xs font-medium transition hover:bg-muted/80"
      title={label}
    >
      <Icon className="h-4 w-4" />
      <input
        type="color"
        className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
        aria-label={label}
        onChange={(event) => {
          if (type === "text") {
            editor.chain().focus().setColor(event.target.value).run();
          } else {
            editor.chain().focus().toggleHighlight({ color: event.target.value }).run();
          }
        }}
      />
    </label>
  );
}
