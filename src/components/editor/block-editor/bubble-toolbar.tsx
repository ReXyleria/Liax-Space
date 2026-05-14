"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react";
import {
  Bold,
  Code,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Italic,
  Pilcrow,
  Quote,
  Strikethrough
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorPopover } from "./color-popover";
import { LinkPopover } from "./link-popover";
import type { EditorTexts } from "./editor-types";

export function BubbleToolbar({ editor, texts }: { editor: Editor; texts: EditorTexts }) {
  const controls = [
    { label: texts.bold, icon: Bold, active: editor.isActive("bold"), action: () => editor.chain().focus().toggleBold().run() },
    { label: texts.italic, icon: Italic, active: editor.isActive("italic"), action: () => editor.chain().focus().toggleItalic().run() },
    { label: texts.strike, icon: Strikethrough, active: editor.isActive("strike"), action: () => editor.chain().focus().toggleStrike().run() },
    { label: texts.inlineCode, icon: Code, active: editor.isActive("code"), action: () => editor.chain().focus().toggleCode().run() },
    { label: texts.paragraph, icon: Pilcrow, active: editor.isActive("paragraph"), action: () => editor.chain().focus().setParagraph().run() },
    { label: texts.heading1, icon: Heading1, active: editor.isActive("heading", { level: 1 }), action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: texts.heading2, icon: Heading2, active: editor.isActive("heading", { level: 2 }), action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: texts.heading3, icon: Heading3, active: editor.isActive("heading", { level: 3 }), action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: texts.heading4, icon: Heading4, active: editor.isActive("heading", { level: 4 }), action: () => editor.chain().focus().toggleHeading({ level: 4 }).run() },
    { label: texts.quote, icon: Quote, active: editor.isActive("blockquote"), action: () => editor.chain().focus().toggleBlockquote().run() },
    { label: texts.codeBlock, icon: Code, active: editor.isActive("codeBlock"), action: () => editor.chain().focus().toggleCodeBlock().run() },
    { label: texts.clearFormat, icon: Eraser, active: false, action: () => editor.chain().focus().unsetAllMarks().clearNodes().run() }
  ];

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: activeEditor, state }) => !state.selection.empty && activeEditor.isEditable}
      tippyOptions={{ duration: 120, placement: "top", maxWidth: "none" }}
      className="z-50 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1 rounded-xl border bg-card/95 p-1 shadow-xl shadow-primary/10 backdrop-blur"
    >
      {controls.map((control) => (
        <Button
          key={control.label}
          type="button"
          variant={control.active ? "primary" : "secondary"}
          className="h-8 px-2"
          onClick={control.action}
          title={control.label}
        >
          <control.icon className="h-4 w-4" />
        </Button>
      ))}
      <LinkPopover editor={editor} texts={texts} />
      <ColorPopover editor={editor} texts={texts} type="text" />
      <ColorPopover editor={editor} texts={texts} type="background" />
    </BubbleMenu>
  );
}
