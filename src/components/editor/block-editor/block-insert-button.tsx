"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditorTexts } from "./editor-types";

export function BlockInsertButton({
  x,
  y,
  visible,
  texts,
  onClick
}: {
  x: number;
  y: number;
  visible: boolean;
  texts: EditorTexts;
  onClick: () => void;
}) {
  if (!visible) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="secondary"
      className="fixed z-[70] h-8 w-8 rounded-full p-0 opacity-80 shadow-md hover:opacity-100"
      style={{ left: Math.max(8, x), top: Math.max(72, y) }}
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
      title={texts.insertBlock}
    >
      <Plus className="h-4 w-4" />
    </Button>
  );
}
