"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditorTexts } from "./editor-types";

export function LinkPopover({ editor, texts }: { editor: Editor; texts: EditorTexts }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");

  useEffect(() => {
    if (open) {
      setHref(String(editor.getAttributes("link").href ?? ""));
    }
  }, [editor, open]);

  function applyLink() {
    const nextHref = href.trim();
    if (!nextHref) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setOpen(false);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: nextHref }).run();
    setOpen(false);
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant={editor.isActive("link") ? "primary" : "secondary"}
        className="h-8 px-2"
        onClick={() => setOpen((current) => !current)}
        title={texts.link}
      >
        <Link2 className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="absolute left-0 top-10 z-[130] w-72 rounded-lg border bg-card p-2 shadow-xl shadow-primary/10">
          <input
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder={texts.linkPlaceholder}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-8 px-2"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                setOpen(false);
              }}
              title={texts.unlink}
            >
              <Unlink className="h-4 w-4" />
            </Button>
            <Button type="button" className="h-8 px-3" onClick={applyLink}>
              {texts.apply}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
