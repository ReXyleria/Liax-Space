"use client";

import type { RefObject } from "react";
import type { Editor } from "@tiptap/react";
import type { EditorTexts } from "./editor-types";

export function EditorTitleBlock({
  title,
  texts,
  inputRef,
  editor,
  onTitleChange,
  onScheduleSave
}: {
  title: string;
  texts: EditorTexts;
  inputRef: RefObject<HTMLInputElement | null>;
  editor: Editor | null;
  onTitleChange: (title: string) => void;
  onScheduleSave?: () => void;
}) {
  return (
    <input
      ref={inputRef}
      name="title"
      required
      value={title}
      placeholder={texts.titlePlaceholder}
      className="w-full border-none bg-transparent text-4xl font-semibold leading-tight tracking-normal outline-none placeholder:text-muted-foreground/55 md:text-5xl"
      onChange={(event) => {
        onTitleChange(event.target.value);
        onScheduleSave?.();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          editor?.chain().focus("start").run();
        }
      }}
    />
  );
}
