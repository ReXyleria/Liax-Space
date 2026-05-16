"use client";

import { useEffect, useRef, useState } from "react";
import { ArticleStatus, ContentVisibility } from "@prisma/client";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { ArticleSettingsDialog } from "@/components/admin/article-settings-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import {
  deleteArticleAction,
  publishArticleAction,
  unpublishArticleAction
} from "@/features/articles/actions";
import type { Locale } from "@/lib/i18n";

export type ArticleRowData = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  cover: string | null;
  status: ArticleStatus;
  visibility: ContentVisibility;
  allowComments: boolean;
  pinned: boolean;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  tags: Array<{ name: string }>;
};

function labels(locale: Locale) {
  return locale === "en"
    ? {
        publish: "Publish",
        unpublish: "Unpublish",
        edit: "Edit",
        settings: "Settings",
        delete: "Delete",
        confirmDelete: "Confirm delete",
        deleteDescription: "This article will be removed from the public site and admin list.",
        cancel: "Cancel"
      }
    : {
        publish: "发布",
        unpublish: "取消发布",
        edit: "编辑",
        settings: "设置",
        delete: "删除",
        confirmDelete: "确认删除",
        deleteDescription: "删除后该文章会从前台和后台列表中移除。",
        cancel: "取消"
      };
}

export function ArticleActionsMenu({
  article,
  tagOptions = [],
  locale = "zh-CN"
}: {
  article: ArticleRowData;
  tagOptions?: Array<{ name: string }>;
  locale?: Locale;
}) {
  const text = labels(locale);
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isPublished = article.status === ArticleStatus.PUBLISHED;

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!confirmDelete && !rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [confirmDelete]);

  return (
    <div ref={rootRef} className="relative flex justify-end">
      <Button type="button" variant="ghost" className="h-9 w-9 p-0" onClick={() => setOpen((current) => !current)}>
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="absolute right-0 top-10 z-50 w-44 rounded-lg border bg-card p-1 text-sm shadow-xl shadow-primary/10">
          <form action={isPublished ? unpublishArticleAction : publishArticleAction}>
            <input type="hidden" name="id" value={article.id} />
            <button type="submit" className="w-full rounded-md px-3 py-2 text-left hover:bg-muted">
              {isPublished ? text.unpublish : text.publish}
            </button>
          </form>
          <Link href={`/admin/articles/${article.id}/edit`} className="block rounded-md px-3 py-2 hover:bg-muted">
            {text.edit}
          </Link>
          <button
            type="button"
            className="w-full rounded-md px-3 py-2 text-left hover:bg-muted"
            onClick={() => {
              setOpen(false);
              setSettingsOpen(true);
            }}
          >
            {text.settings}
          </button>
          <button
            type="button"
            className="w-full rounded-md px-3 py-2 text-left text-destructive hover:bg-destructive/10"
            onClick={() => {
              setOpen(false);
              setConfirmDelete(true);
            }}
          >
            {text.delete}
          </button>
        </div>
      ) : null}
      <ConfirmActionDialog
        open={confirmDelete}
        title={text.confirmDelete}
        description={text.deleteDescription}
        confirmLabel={text.confirmDelete}
        cancelLabel={text.cancel}
        onOpenChange={setConfirmDelete}
        action={deleteArticleAction}
        hiddenFields={[{ name: "id", value: article.id }]}
      />
      <ArticleSettingsDialog
        article={article}
        tagOptions={tagOptions}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        locale={locale}
      />
    </div>
  );
}
