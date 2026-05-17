"use client";

import { type RefObject, useCallback, useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Columns3, Redo2, Rows3, Table2, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditorTexts } from "./editor-types";

type ToolbarRect = {
  left: number;
  top: number;
};

function activeTableElement(editor: Editor) {
  const root = editor.view.dom as HTMLElement;
  const domAtPos = editor.view.domAtPos(editor.state.selection.from).node;
  const element = domAtPos.nodeType === Node.ELEMENT_NODE ? (domAtPos as Element) : domAtPos.parentElement;
  return (element?.closest("table") as HTMLTableElement | null) ?? root.querySelector("table");
}

export function TableFloatingToolbar({
  editor,
  overlayRef,
  texts,
  onAddRow,
  onDeleteRow,
  onAddColumn,
  onDeleteColumn,
  onToggleHeaderRow,
  onToggleHeaderColumn,
  onDeleteTable,
  onUndo,
  onRedo
}: {
  editor: Editor;
  overlayRef: RefObject<HTMLDivElement | null>;
  texts: EditorTexts;
  onAddRow: () => void;
  onDeleteRow: () => void;
  onAddColumn: () => void;
  onDeleteColumn: () => void;
  onToggleHeaderRow: () => void;
  onToggleHeaderColumn: () => void;
  onDeleteTable: () => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const [rect, setRect] = useState<ToolbarRect | null>(null);

  const refreshRect = useCallback(() => {
    if (!editor.isActive("table")) {
      setRect(null);
      return;
    }

    const overlay = overlayRef.current;
    const table = activeTableElement(editor);
    if (!overlay || !table) {
      setRect(null);
      return;
    }

    const nextRect = table.getBoundingClientRect();
    const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
    if (nextRect.bottom < 12 || nextRect.top > viewportHeight - 12) {
      setRect(null);
      return;
    }

    const overlayRect = overlay.getBoundingClientRect();
    const toolbarWidth = 760;
    const toolbarHeight = 48;
    const minVisibleTop = Math.max(8, 12 - overlayRect.top);
    const preferredTop = nextRect.top - overlayRect.top - toolbarHeight - 8;
    const maxLeft = Math.max(8, overlayRect.width - Math.min(toolbarWidth, overlayRect.width) - 8);
    setRect({
      left: Math.max(8, Math.min(nextRect.left - overlayRect.left, maxLeft)),
      top: Math.max(minVisibleTop, preferredTop)
    });
  }, [editor, overlayRef]);

  useEffect(() => {
    refreshRect();
    let frame = 0;
    const scheduleRefresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(refreshRect);
    };
    editor.on("selectionUpdate", scheduleRefresh);
    editor.on("update", scheduleRefresh);
    window.addEventListener("resize", scheduleRefresh);
    window.addEventListener("scroll", scheduleRefresh, true);

    return () => {
      window.cancelAnimationFrame(frame);
      editor.off("selectionUpdate", scheduleRefresh);
      editor.off("update", scheduleRefresh);
      window.removeEventListener("resize", scheduleRefresh);
      window.removeEventListener("scroll", scheduleRefresh, true);
    };
  }, [editor, refreshRect]);

  if (!rect) {
    return null;
  }

  return (
    <div
      className="absolute z-[120] flex max-w-[min(92vw,760px)] flex-wrap items-center gap-2 rounded-xl border bg-card/96 p-2 shadow-2xl shadow-black/10 backdrop-blur"
      style={{ left: rect.left, top: rect.top }}
      contentEditable={false}
    >
      <Button type="button" variant="secondary" className="h-8 px-2" onClick={onUndo} title={texts.undo}>
        <Undo2 className="mr-1 h-4 w-4" />
        {texts.undo}
      </Button>
      <Button type="button" variant="secondary" className="h-8 px-2" onClick={onRedo} title={texts.redo}>
        <Redo2 className="mr-1 h-4 w-4" />
        {texts.redo}
      </Button>
      <Button type="button" variant="secondary" className="h-8 px-2" onClick={onAddRow} title={texts.addRow}>
        <Rows3 className="mr-1 h-4 w-4" />
        {texts.addRow}
      </Button>
      <Button type="button" variant="secondary" className="h-8 px-2" onClick={onDeleteRow} title={texts.deleteRow}>
        {texts.deleteRow}
      </Button>
      <Button type="button" variant="secondary" className="h-8 px-2" onClick={onAddColumn} title={texts.addColumn}>
        <Columns3 className="mr-1 h-4 w-4" />
        {texts.addColumn}
      </Button>
      <Button type="button" variant="secondary" className="h-8 px-2" onClick={onDeleteColumn} title={texts.deleteColumn}>
        {texts.deleteColumn}
      </Button>
      <Button type="button" variant="secondary" className="h-8 px-2" onClick={onToggleHeaderRow} title={texts.headerRow}>
        <Table2 className="mr-1 h-4 w-4" />
        {texts.headerRow}
      </Button>
      <Button type="button" variant="secondary" className="h-8 px-2" onClick={onToggleHeaderColumn} title={texts.headerColumn}>
        {texts.headerColumn}
      </Button>
      <Button type="button" variant="danger" className="h-8 px-2" onClick={onDeleteTable} title={texts.deleteTable}>
        <Trash2 className="mr-1 h-4 w-4" />
        {texts.deleteTable}
      </Button>
    </div>
  );
}
