"use client";

import type { Editor } from "@tiptap/react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditorTexts } from "./editor-types";

export function ImageBlockToolbar({
  editor,
  texts,
  onReplace,
  onResize
}: {
  editor: Editor;
  texts: EditorTexts;
  onReplace: () => void;
  onResize: (attrs: Record<string, string | null>) => void;
}) {
  if (!editor.isActive("image")) {
    return null;
  }

  return (
    <div className="sticky bottom-4 z-30 mt-4 flex items-center gap-2 rounded-xl border bg-card/95 p-2 shadow-xl shadow-primary/10 backdrop-blur">
      <Button type="button" variant="secondary" className="h-8 px-2" onClick={onReplace}>
        <ImagePlus className="mr-1 h-4 w-4" />
        {texts.replaceImage}
      </Button>
      <Button type="button" variant="secondary" className="h-8 px-2" onClick={() => onResize({ width: "50%", height: null })}>
        50%
      </Button>
      <Button type="button" variant="secondary" className="h-8 px-2" onClick={() => onResize({ width: "75%", height: null })}>
        75%
      </Button>
      <Button type="button" variant="secondary" className="h-8 px-2" onClick={() => onResize({ width: "100%", height: null })}>
        100%
      </Button>
      <Button type="button" variant="secondary" className="h-8 px-2" onClick={() => onResize({ width: null, height: null })}>
        {texts.resetImage}
      </Button>
      <Button
        type="button"
        variant="danger"
        className="h-8 px-2"
        onClick={() => editor.chain().focus().deleteSelection().run()}
      >
        <Trash2 className="mr-1 h-4 w-4" />
        {texts.removeImage}
      </Button>
    </div>
  );
}
