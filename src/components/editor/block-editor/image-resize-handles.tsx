"use client";

import { useCallback, useEffect, useState } from "react";
import type React from "react";
import type { Editor } from "@tiptap/react";

type ImageRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type HandlePosition = "right" | "bottom" | "corner";

function selectedImage(editor: Editor) {
  const root = editor.view.dom as HTMLElement;
  const selected = root.querySelector("img.ProseMirror-selectednode") as HTMLImageElement | null;
  if (selected) {
    return selected;
  }

  const domAtPos = editor.view.domAtPos(editor.state.selection.from).node;
  const element = domAtPos.nodeType === Node.ELEMENT_NODE ? domAtPos as Element : domAtPos.parentElement;
  return element?.closest("img") as HTMLImageElement | null;
}

export function ImageResizeHandles({
  editor,
  onResize
}: {
  editor: Editor;
  onResize: (attrs: Record<string, string | null>) => void;
}) {
  const [rect, setRect] = useState<ImageRect | null>(null);

  const refreshRect = useCallback(() => {
    if (!editor.isActive("image")) {
      setRect(null);
      return;
    }

    const image = selectedImage(editor);
    if (!image) {
      setRect(null);
      return;
    }

    const nextRect = image.getBoundingClientRect();
    setRect({
      left: nextRect.left,
      top: nextRect.top,
      width: nextRect.width,
      height: nextRect.height
    });
  }, [editor]);

  useEffect(() => {
    refreshRect();
    editor.on("selectionUpdate", refreshRect);
    editor.on("update", refreshRect);
    window.addEventListener("resize", refreshRect);
    window.addEventListener("scroll", refreshRect, true);

    return () => {
      editor.off("selectionUpdate", refreshRect);
      editor.off("update", refreshRect);
      window.removeEventListener("resize", refreshRect);
      window.removeEventListener("scroll", refreshRect, true);
    };
  }, [editor, refreshRect]);

  const startDrag = (position: HandlePosition, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const image = selectedImage(editor);
    if (!image) {
      return;
    }

    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const startRect = image.getBoundingClientRect();
    const aspectRatio = startRect.width / Math.max(1, startRect.height);
    const button = event.currentTarget;
    button.setPointerCapture(pointerId);

    const preview = (width: number, height: number) => {
      image.style.width = `${width}px`;
      image.style.height = `${height}px`;
      setRect({
        left: startRect.left,
        top: startRect.top,
        width,
        height
      });
    };

    const dimensionsFor = (clientX: number, clientY: number) => {
      const minWidth = 96;
      const minHeight = 64;
      let width = startRect.width;
      let height = startRect.height;

      if (position === "right") {
        width = Math.max(minWidth, startRect.width + clientX - startX);
      } else if (position === "bottom") {
        height = Math.max(minHeight, startRect.height + clientY - startY);
      } else {
        width = Math.max(minWidth, startRect.width + clientX - startX);
        height = Math.max(minHeight, Math.round(width / aspectRatio));
      }

      return { width: Math.round(width), height: Math.round(height) };
    };

    const onPointerMove = (moveEvent: PointerEvent) => {
      const next = dimensionsFor(moveEvent.clientX, moveEvent.clientY);
      preview(next.width, next.height);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      const next = dimensionsFor(upEvent.clientX, upEvent.clientY);
      onResize({ width: `${next.width}px`, height: `${next.height}px` });
      button.releasePointerCapture(pointerId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.setTimeout(refreshRect, 0);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  };

  if (!rect) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Resize image width"
        className="editor-image-resize-handle editor-image-resize-handle-right"
        style={{ left: rect.left + rect.width - 6, top: rect.top + rect.height / 2 - 12 }}
        onPointerDown={(event) => startDrag("right", event)}
      />
      <button
        type="button"
        aria-label="Resize image height"
        className="editor-image-resize-handle editor-image-resize-handle-bottom"
        style={{ left: rect.left + rect.width / 2 - 12, top: rect.top + rect.height - 6 }}
        onPointerDown={(event) => startDrag("bottom", event)}
      />
      <button
        type="button"
        aria-label="Resize image proportionally"
        className="editor-image-resize-handle editor-image-resize-handle-corner"
        style={{ left: rect.left + rect.width - 8, top: rect.top + rect.height - 8 }}
        onPointerDown={(event) => startDrag("corner", event)}
      />
    </>
  );
}
