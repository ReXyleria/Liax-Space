"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditorTexts } from "./editor-types";

export function CodeBlockToolbar({ editor, texts }: { editor: Editor; texts: EditorTexts }) {
  const [copied, setCopied] = useState(false);

  if (!editor.isActive("codeBlock")) {
    return null;
  }

  async function copyActiveCode() {
    const { $from } = editor.state.selection;
    const text = $from.parent.textContent;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="sticky bottom-4 z-30 mt-4 flex items-center gap-2 rounded-xl border bg-card/95 p-2 shadow-xl shadow-primary/10 backdrop-blur">
      <Button type="button" variant="secondary" className="h-8 px-2" onClick={copyActiveCode}>
        <Copy className="mr-1 h-4 w-4" />
        {copied ? texts.copied : texts.copy}
      </Button>
    </div>
  );
}
