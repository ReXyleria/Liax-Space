"use client";

import type { PointerEvent, RefObject } from "react";
import type { Editor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";
import type { EditorTexts } from "./editor-types";
import { ensureTrailingParagraph, placeCursorFromPaperClick } from "./table-commands";

export function EditorContentArea({
  editor,
  texts,
  fileInputRef,
  uploadMessage,
  isUploading,
  onFileSelected
}: {
  editor: Editor | null;
  texts: EditorTexts;
  fileInputRef: RefObject<HTMLInputElement | null>;
  uploadMessage: string;
  isUploading: boolean;
  onFileSelected: (file: File) => void;
}) {
  function focusPaperBlank(event: PointerEvent<HTMLDivElement>) {
    if (!editor || event.defaultPrevented) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("button,input,textarea,select,[contenteditable='false'],.editor-code-copy,.editor-table-resize-handle,.editor-image-resize-handle")) {
      return;
    }

    const paperBox = event.currentTarget.getBoundingClientRect();
    const clickedInsidePaper =
      event.clientX >= paperBox.left &&
      event.clientX <= paperBox.right &&
      event.clientY >= paperBox.top &&
      event.clientY <= paperBox.bottom;

    if (!clickedInsidePaper) {
      return;
    }

    ensureTrailingParagraph(editor);
    placeCursorFromPaperClick(editor, event.clientX, event.clientY);
  }

  return (
    <div className="relative min-h-[620px] cursor-text" onPointerDown={focusPaperBlank}>
      <input
        ref={fileInputRef}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            onFileSelected(file);
          }
          event.currentTarget.value = "";
        }}
      />
      <EditorContent editor={editor} />
      {!editor ? (
        <div className="space-y-3 py-10">
          <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-5 w-4/5 animate-pulse rounded bg-muted" />
          <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      ) : null}
      {isUploading ? <p className="mt-3 text-xs text-muted-foreground">{texts.uploadImage}...</p> : null}
      {uploadMessage ? <p className="mt-3 text-xs text-muted-foreground">{uploadMessage}</p> : null}
    </div>
  );
}
