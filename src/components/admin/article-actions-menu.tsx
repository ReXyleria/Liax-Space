"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArticleStatus } from "@prisma/client";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deleteArticleAction,
  publishArticleAction,
  unpublishArticleAction
} from "@/features/articles/actions";
import type { Locale } from "@/lib/i18n";

function labels(locale: Locale) {
  return locale === "en"
    ? {
        publish: "Publish",
        unpublish: "Unpublish",
        edit: "Edit",
        settings: "Settings",
        delete: "Delete",
        confirmDelete: "Confirm delete"
      }
    : {
        publish: "发布",
        unpublish: "取消发布",
        edit: "编辑",
        settings: "设置",
        delete: "删除",
        confirmDelete: "确认删除"
      };
}

export function ArticleActionsMenu({
  id,
  status,
  locale = "zh-CN"
}: {
  id: string;
  status: ArticleStatus;
  locale?: Locale;
}) {
  const text = labels(locale);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isPublished = status === ArticleStatus.PUBLISHED;

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setConfirmDelete(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative flex justify-end">
      <Button type="button" variant="ghost" className="h-9 w-9 p-0" onClick={() => setOpen((current) => !current)}>
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="absolute right-0 top-10 z-50 w-44 rounded-lg border bg-card p-1 text-sm shadow-xl shadow-primary/10">
          <form action={isPublished ? unpublishArticleAction : publishArticleAction}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className="w-full rounded-md px-3 py-2 text-left hover:bg-muted">
              {isPublished ? text.unpublish : text.publish}
            </button>
          </form>
          <Link href={`/admin/articles/${id}/edit`} className="block rounded-md px-3 py-2 hover:bg-muted">
            {text.edit}
          </Link>
          <Link href={`/admin/articles/${id}/edit?panel=settings`} className="block rounded-md px-3 py-2 hover:bg-muted">
            {text.settings}
          </Link>
          {confirmDelete ? (
            <form action={deleteArticleAction}>
              <input type="hidden" name="id" value={id} />
              <button type="submit" className="w-full rounded-md px-3 py-2 text-left text-destructive hover:bg-destructive/10">
                {text.confirmDelete}
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="w-full rounded-md px-3 py-2 text-left text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmDelete(true)}
            >
              {text.delete}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
