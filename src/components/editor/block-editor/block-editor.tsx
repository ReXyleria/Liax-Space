"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { CellSelection } from "@tiptap/pm/tables";
import { BubbleToolbar } from "./bubble-toolbar";
import { CodeBlockToolbar } from "./code-block-toolbar";
import { createEditorExtensions } from "./editor-extensions";
import { editorText } from "./editor-i18n";
import { EditorContentArea } from "./editor-content-area";
import { EditorShell } from "./editor-shell";
import { EditorTitleBlock } from "./editor-title-block";
import { ImageBlockToolbar } from "./image-block-toolbar";
import { ImageResizeHandles } from "./image-resize-handles";
import { filterCommands, SlashCommandMenu } from "./slash-command-menu";
import { TableFloatingToolbar } from "./table-floating-toolbar";
import {
  deleteCurrentTable,
  ensureTrailingParagraph,
  guardBlockBoundaryEditing
} from "./table-commands";
import type { BlockCommand, BlockEditorLocale, EditorTocItem, SlashMenuState } from "./editor-types";
import { createBlockCommands, runCommandAfterDeletingRange, safeJsonString } from "./editor-utils";
import { UploadProgressDialog } from "@/components/forms/upload-progress-dialog";
import { emptyUploadProgress, uploadImageFile, type UploadProgressState } from "@/lib/upload-client";

const CLOSED_SLASH_MENU: SlashMenuState = {
  open: false,
  x: 0,
  y: 0,
  query: "",
  selected: 0,
  range: null,
  placement: "bottom"
};
const SLASH_MENU_WIDTH = 288;
const SLASH_MENU_HEIGHT = 320;

function clampSlashMenuPosition(
  coords: { left: number; top: number; bottom: number },
  overlay: DOMRect
) {
  const bottomY = coords.bottom - overlay.top + 6;
  const topY = coords.top - overlay.top - SLASH_MENU_HEIGHT - 6;
  const placement: "top" | "bottom" =
    coords.bottom + SLASH_MENU_HEIGHT + 6 > window.innerHeight && topY >= 8 ? "top" : "bottom";
  const rawY = placement === "top" ? topY : bottomY;
  const rawX = coords.left - overlay.left;

  return {
    x: Math.max(8, Math.min(rawX, Math.max(8, overlay.width - SLASH_MENU_WIDTH - 8))),
    y: Math.max(8, rawY),
    placement
  };
}

function slugifyHeading(value: string, fallback: string) {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

function collectEditorTocItems(activeEditor: Editor): EditorTocItem[] {
  const seen = new Map<string, number>();
  const items: EditorTocItem[] = [];

  activeEditor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading") {
      return;
    }

    const title = node.textContent.trim();
    if (!title) {
      return;
    }

    const level = Number(node.attrs.level);
    if (![1, 2, 3, 4].includes(level)) {
      return;
    }

    const baseId = slugifyHeading(title, `editor-heading-${items.length + 1}`);
    const count = seen.get(baseId) ?? 0;
    seen.set(baseId, count + 1);
    items.push({
      id: count ? `${baseId}-${count + 1}` : baseId,
      title,
      level: level as 1 | 2 | 3 | 4,
      pos
    });
  });

  return items;
}

export function BlockEditor({
  title,
  locale = "zh-CN",
  initialHtml = "",
  initialJson,
  htmlName = "contentHtml",
  jsonName = "contentJson",
  onTitleChange,
  onContentChange
}: {
  title: string;
  locale?: BlockEditorLocale;
  initialHtml?: string;
  initialJson?: unknown;
  htmlName?: string;
  jsonName?: string;
  onTitleChange: (title: string) => void;
  onContentChange?: () => void;
}) {
  const texts = editorText[locale] ?? editorText["zh-CN"];
  const titleRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateTimerRef = useRef<number | null>(null);
  const tocTimerRef = useRef<number | null>(null);
  const slashMenuRef = useRef(CLOSED_SLASH_MENU);
  const filteredCommandsRef = useRef<BlockCommand[]>([]);
  const editorOverlayRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(initialHtml);
  const [json, setJson] = useState(() => safeJsonString(initialJson));
  const [status, setStatus] = useState<"idle" | "saved" | "unsaved">("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadState, setUploadState] = useState<UploadProgressState>(() => emptyUploadProgress());
  const [slashMenu, setSlashMenu] = useState<SlashMenuState>(CLOSED_SLASH_MENU);

  const openImagePicker = useCallback(() => fileInputRef.current?.click(), []);
  const commands = useMemo(() => createBlockCommands(texts, openImagePicker), [texts, openImagePicker]);
  const filteredCommands = useMemo(
    () => filterCommands(commands, slashMenu.query),
    [commands, slashMenu.query]
  );
  filteredCommandsRef.current = filteredCommands;

  const extensions = useMemo(() => createEditorExtensions(texts.bodyPlaceholder), [texts.bodyPlaceholder]);

  const queueContentSync = useCallback((activeEditor: Editor) => {
    setStatus("unsaved");
    if (updateTimerRef.current) {
      window.clearTimeout(updateTimerRef.current);
    }

    updateTimerRef.current = window.setTimeout(() => {
      setHtml(activeEditor.getHTML());
      setJson(safeJsonString(activeEditor.getJSON()));
      onContentChange?.();
      setStatus("saved");
    }, 260);
  }, [onContentChange]);

  const closeSlashMenu = useCallback(() => {
    setSlashMenu((current) => (current.open ? CLOSED_SLASH_MENU : current));
  }, []);

  const publishEditorToc = useCallback((activeEditor: Editor) => {
    const items = collectEditorTocItems(activeEditor);
    window.dispatchEvent(new CustomEvent("editor-toc:update", { detail: { items } }));
    const activeId =
      [...items].reverse().find((item) => item.pos <= activeEditor.state.selection.from)?.id ??
      items[0]?.id ??
      "";
    window.dispatchEvent(new CustomEvent("editor-toc:active", { detail: { id: activeId } }));
  }, []);

  const scheduleEditorTocPublish = useCallback((activeEditor: Editor) => {
    if (tocTimerRef.current) {
      window.clearTimeout(tocTimerRef.current);
    }
    tocTimerRef.current = window.setTimeout(() => publishEditorToc(activeEditor), 120);
  }, [publishEditorToc]);

  const syncSlashMenu = useCallback((activeEditor: Editor) => {
    const { state, view } = activeEditor;
    const { from, empty } = state.selection;
    if (!empty) {
      closeSlashMenu();
      return;
    }

    const textBefore = state.selection.$from.parent.textBetween(0, state.selection.$from.parentOffset, "\n", "\n");
    if (textBefore.includes("\n")) {
      closeSlashMenu();
      return;
    }

    const slashIndex = textBefore.lastIndexOf("/");
    const hasValidTrigger = slashIndex >= 0 && (slashIndex === 0 || /\s/.test(textBefore.charAt(slashIndex - 1)));
    if (!hasValidTrigger) {
      closeSlashMenu();
      return;
    }

    const query = textBefore.slice(slashIndex + 1);
    if (/\s/.test(query)) {
      closeSlashMenu();
      return;
    }

    const overlay = editorOverlayRef.current?.getBoundingClientRect();
    if (!overlay) {
      closeSlashMenu();
      return;
    }

    const range = { from: from - (textBefore.length - slashIndex), to: from };
    const coords = view.coordsAtPos(Math.min(range.from + 1, state.doc.content.size));
    const position = clampSlashMenuPosition(coords, overlay);
    setSlashMenu((current) => ({
      open: true,
      x: position.x,
      y: position.y,
      query,
      selected: current.open ? Math.min(current.selected, Math.max(0, filteredCommandsRef.current.length - 1)) : 0,
      range,
      placement: position.placement
    }));
  }, [closeSlashMenu]);

  const editor = useEditor({
    extensions,
    content: initialJson ? initialJson : initialHtml,
    immediatelyRender: false,
    onUpdate({ editor: activeEditor }) {
      queueContentSync(activeEditor);
      syncSlashMenu(activeEditor);
      scheduleEditorTocPublish(activeEditor);
    },
    onSelectionUpdate({ editor: activeEditor }) {
      syncSlashMenu(activeEditor);
      scheduleEditorTocPublish(activeEditor);
    },
    editorProps: {
      attributes: {
        class:
          "editor-surface block-editor-surface prose-content min-h-[520px] w-full bg-transparent text-base leading-8 outline-none"
      },
      handleKeyDown: (_view, event) => {
        if (editor && guardBlockBoundaryEditing(editor, event)) {
          return true;
        }

        const currentMenu = slashMenuRef.current;
        if (!currentMenu.open) {
          return false;
        }

        const activeCommands = filteredCommandsRef.current;
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSlashMenu((current) => ({
            ...current,
            selected: activeCommands.length ? (current.selected + 1) % activeCommands.length : 0
          }));
          return true;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          setSlashMenu((current) => ({
            ...current,
            selected: activeCommands.length ? (current.selected - 1 + activeCommands.length) % activeCommands.length : 0
          }));
          return true;
        }

        if (event.key === "Enter") {
          event.preventDefault();
          const command = activeCommands[currentMenu.selected] ?? activeCommands[0];
          if (command) {
            runCommandAfterDeletingRange(editor!, command, currentMenu.range);
            ensureTrailingParagraph(editor!);
          }
          closeSlashMenu();
          return true;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          closeSlashMenu();
          return true;
        }

        return false;
      },
      handlePaste: (_view, event) => {
        const image = Array.from(event.clipboardData?.files ?? []).find((file) => file.type.startsWith("image/"));
        if (image) {
          event.preventDefault();
          uploadImage(image);
          return true;
        }

        const htmlContent = event.clipboardData?.getData("text/html") ?? "";
        if (htmlContent && /<img[\s>]/i.test(htmlContent)) {
          event.preventDefault();
          localizePastedHtmlImages(htmlContent);
          return true;
        }

        return false;
      }
    }
  });

  useEffect(() => {
    slashMenuRef.current = slashMenu;
  }, [slashMenu]);

  useEffect(() => {
    if (!editor || !slashMenu.open) {
      return;
    }

    let frame = 0;
    const refreshFromWindow = (event: Event) => {
      const target = event?.target;
      if (target instanceof Element && target.closest("[data-slash-menu]")) {
        return;
      }
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => syncSlashMenu(editor));
    };
    const refreshFromEditor = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => syncSlashMenu(editor));
    };

    window.addEventListener("resize", refreshFromWindow);
    window.addEventListener("scroll", refreshFromWindow, true);
    editor.on("update", refreshFromEditor);
    editor.on("selectionUpdate", refreshFromEditor);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", refreshFromWindow);
      window.removeEventListener("scroll", refreshFromWindow, true);
      editor.off("update", refreshFromEditor);
      editor.off("selectionUpdate", refreshFromEditor);
    };
  }, [editor, slashMenu.open, syncSlashMenu]);

  useEffect(() => {
    if (!editor || html) {
      return;
    }
    setHtml(editor.getHTML());
    setJson(safeJsonString(editor.getJSON()));
  }, [editor, html]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    ensureTrailingParagraph(editor);
    publishEditorToc(editor);
    const handleTocRequest = () => publishEditorToc(editor);
    window.addEventListener("editor-toc:request", handleTocRequest);
    return () => window.removeEventListener("editor-toc:request", handleTocRequest);
  }, [editor, publishEditorToc]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const handleTocNavigation = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; pos?: number }>).detail;
      const pos = typeof detail?.pos === "number" ? detail.pos : null;
      if (pos === null) {
        return;
      }

      const safePos = Math.max(1, Math.min(pos + 1, editor.state.doc.content.size));
      try {
        const selection = TextSelection.near(editor.state.doc.resolve(safePos), 1);
        editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView());
        editor.commands.focus();
        window.requestAnimationFrame(() => {
          const coords = editor.view.coordsAtPos(safePos);
          const offset = 96;
          if (coords.top < offset || coords.top > window.innerHeight - 120) {
            window.scrollBy({ top: coords.top - offset, behavior: "smooth" });
          }
        });
      } catch {
        editor.commands.focus();
      }
    };

    window.addEventListener("editor-toc:navigate", handleTocNavigation);
    return () => window.removeEventListener("editor-toc:navigate", handleTocNavigation);
  }, [editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const decorateCodeBlocks = () => {
      const root = editor.view.dom;
      root.querySelectorAll(".editor-code-copy").forEach((button) => button.remove());
      root.querySelectorAll("pre").forEach((pre) => {
        pre.classList.add("editor-code-block");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = texts.copy;
        button.contentEditable = "false";
        button.className = "editor-code-copy";
        button.addEventListener("click", async (event) => {
          event.preventDefault();
          const code = pre.querySelector("code")?.textContent ?? pre.textContent ?? "";
          await navigator.clipboard.writeText(code);
          button.textContent = texts.copied;
          window.setTimeout(() => {
            button.textContent = texts.copy;
          }, 1200);
        });
        pre.appendChild(button);
      });
    };

    decorateCodeBlocks();
    editor.on("update", decorateCodeBlocks);

    return () => {
      editor.off("update", decorateCodeBlocks);
      editor.view.dom.querySelectorAll(".editor-code-copy").forEach((button) => button.remove());
    };
  }, [editor, texts.copy, texts.copied]);

  useEffect(() => () => {
    if (updateTimerRef.current) {
      window.clearTimeout(updateTimerRef.current);
    }
    if (tocTimerRef.current) {
      window.clearTimeout(tocTimerRef.current);
    }
  }, []);

  function runSlashCommand(index: number) {
    if (!editor) {
      return;
    }

    const command = filteredCommandsRef.current[index] ?? filteredCommandsRef.current[0];
    if (!command) {
      return;
    }

    runCommandAfterDeletingRange(editor, command, slashMenuRef.current.range);
    ensureTrailingParagraph(editor);
    closeSlashMenu();
  }

  async function uploadImage(file: File) {
    setUploadMessage("");
    setIsUploading(true);
    setUploadOpen(true);

    try {
      const result = await uploadImageFile(file, setUploadState);

      if (!result.ok || !result.asset?.url) {
        setUploadMessage(result.message ?? texts.uploadFailed);
        return;
      }

      editor?.chain().focus().setImage({ src: result.asset.url }).run();
      if (editor) {
        ensureTrailingParagraph(editor);
      }
      setUploadMessage(texts.uploadDone);
    } finally {
      setIsUploading(false);
    }
  }

  function localizePastedHtmlImages(htmlContent: string) {
    setIsUploading(true);
    void (async () => {
      try {
        setUploadMessage("");
        const document = new DOMParser().parseFromString(htmlContent, "text/html");
        const images = Array.from(document.querySelectorAll("img"));
        const failures: string[] = [];

        for (const image of images) {
          const src = image.getAttribute("src")?.trim() ?? "";
          if (!src || src.startsWith("/uploads/")) {
            continue;
          }

          try {
            const response = await fetch("/api/upload/remote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ src })
            });
            const result = (await response.json()) as { ok?: boolean; message?: string; asset?: { url: string } };

            if (!response.ok || !result.ok || !result.asset?.url) {
              failures.push(`${src} - ${result.message ?? texts.uploadFailed}`);
              image.removeAttribute("src");
              image.setAttribute("data-import-error", result.message ?? texts.uploadFailed);
              continue;
            }

            image.setAttribute("src", result.asset.url);
          } catch (error) {
            failures.push(`${src} - ${error instanceof Error ? error.message : texts.uploadFailed}`);
            image.removeAttribute("src");
          }
        }

        editor?.chain().focus().insertContent(document.body.innerHTML).run();
        if (editor) {
          ensureTrailingParagraph(editor);
        }
        setUploadMessage(
          failures.length
            ? `The following images failed to import: ${failures.join("; ")}`
            : texts.uploadDone
        );
      } finally {
        setIsUploading(false);
      }
    })();
  }

  const resizeImage = useCallback((attrs: Record<string, string | null>) => {
    if (!editor) {
      return;
    }
    editor.chain().focus().updateAttributes("image", attrs).run();
    queueContentSync(editor);
  }, [editor, queueContentSync]);

  const addTableRow = useCallback(() => {
    editor?.chain().focus().addRowAfter().run();
    if (editor) {
      ensureTrailingParagraph(editor);
    }
  }, [editor]);

  const deleteTableRow = useCallback(() => {
    editor?.chain().focus().deleteRow().run();
    if (editor) {
      ensureTrailingParagraph(editor);
    }
  }, [editor]);

  const addTableColumn = useCallback(() => {
    editor?.chain().focus().addColumnAfter().run();
    if (editor) {
      ensureTrailingParagraph(editor);
    }
  }, [editor]);

  const deleteTableColumn = useCallback(() => {
    editor?.chain().focus().deleteColumn().run();
    if (editor) {
      ensureTrailingParagraph(editor);
    }
  }, [editor]);

  const toggleTableHeaderRow = useCallback(() => {
    editor?.chain().focus().toggleHeaderRow().run();
  }, [editor]);

  const toggleTableHeaderColumn = useCallback(() => {
    editor?.chain().focus().toggleHeaderColumn().run();
  }, [editor]);

  const hasCellSelection = editor?.state.selection instanceof CellSelection;

  return (
    <EditorShell texts={texts} status={status}>
      <input type="hidden" name={htmlName} value={html} />
      <input type="hidden" name={jsonName} value={json} />
      <EditorTitleBlock
        title={title}
        texts={texts}
        inputRef={titleRef}
        editor={editor}
        onTitleChange={onTitleChange}
        onScheduleSave={onContentChange}
      />
      <div ref={editorOverlayRef} className="relative mt-3">
        {editor ? <BubbleToolbar editor={editor} texts={texts} /> : null}
        <EditorContentArea
          editor={editor}
          texts={texts}
          fileInputRef={fileInputRef}
          uploadMessage={uploadMessage}
          isUploading={isUploading}
          onFileSelected={uploadImage}
        />
        {editor ? (
          <>
            <TableFloatingToolbar
              editor={editor}
              overlayRef={editorOverlayRef}
              texts={texts}
              onAddRow={addTableRow}
              onDeleteRow={deleteTableRow}
              onAddColumn={addTableColumn}
              onDeleteColumn={deleteTableColumn}
              onToggleHeaderRow={toggleTableHeaderRow}
              onToggleHeaderColumn={toggleTableHeaderColumn}
              onDeleteTable={() => deleteCurrentTable(editor)}
              onUndo={() => editor.chain().focus().undo().run()}
              onRedo={() => editor.chain().focus().redo().run()}
            />
            <ImageBlockToolbar editor={editor} texts={texts} onReplace={openImagePicker} onResize={resizeImage} />
            <ImageResizeHandles editor={editor} onResize={resizeImage} />
            <CodeBlockToolbar editor={editor} texts={texts} />
            <SlashCommandMenu
              commands={filteredCommands}
              menu={slashMenu}
              texts={texts}
              onHover={(index) => setSlashMenu((current) => ({ ...current, selected: index }))}
              onRun={runSlashCommand}
            />
          </>
        ) : null}
        {editor && hasCellSelection ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Cell selections clear content only. Use the table toolbar to remove rows, columns, or the whole table.
          </p>
        ) : null}
      </div>
      <UploadProgressDialog open={uploadOpen} state={uploadState} onOpenChange={setUploadOpen} />
    </EditorShell>
  );
}
