"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createTagAction, deleteTagAction, updateTagAction, type TagActionState } from "@/features/tags/actions";
import type { Locale } from "@/lib/i18n-messages";

type TagRow = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  articleCount: number;
};

const initialState: TagActionState = { ok: false, message: "", fieldErrors: {} };

function copy(locale: Locale) {
  return locale === "en"
    ? {
        newTag: "New tag",
        name: "Name",
        slug: "Slug",
        color: "Color",
        create: "Create tag",
        creating: "Creating...",
        edit: "Edit",
        delete: "Delete",
        save: "Save",
        saving: "Saving...",
        deleting: "Deleting...",
        deleteTitle: "Delete tag",
        deleteDescription: "The tag will be removed after detaching it from linked articles.",
        cancel: "Cancel",
        articles: "articles",
        empty: "No tags yet. Create the first tag here."
      }
    : {
        newTag: "新建标签",
        name: "名称",
        slug: "别名",
        color: "颜色",
        create: "创建标签",
        creating: "创建中...",
        edit: "编辑",
        delete: "删除",
        save: "保存",
        saving: "保存中...",
        deleting: "删除中...",
        deleteTitle: "删除标签",
        deleteDescription: "系统会先解除文章关联，再删除标签本体。",
        cancel: "取消",
        articles: "篇文章",
        empty: "暂时没有标签，先在这里创建一个。"
      };
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

function TagEditDialog({ locale, tag }: { locale: Locale; tag: TagRow }) {
  const router = useRouter();
  const text = copy(locale);
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState<TagActionState, FormData>(updateTagAction, initialState);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [router, state.ok]);

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Pencil className="mr-2 h-4 w-4" />
        {text.edit}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={text.edit}
        description={`${tag.name} / ${tag.slug}`}
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={tag.id} />
          <label className="block space-y-2 text-sm">
            <span className="font-medium">{text.name}</span>
            <Input name="name" defaultValue={tag.name} />
            <FieldError message={state.fieldErrors.name?.[0]} />
          </label>
          <label className="block space-y-2 text-sm">
            <span className="font-medium">{text.slug}</span>
            <Input name="slug" defaultValue={tag.slug} />
            <FieldError message={state.fieldErrors.slug?.[0]} />
          </label>
          <label className="block space-y-2 text-sm">
            <span className="font-medium">{text.color}</span>
            <div className="flex items-center gap-3">
              <Input name="color" type="color" defaultValue={tag.color || "#7187f3"} className="h-11 w-16 p-1" />
              <Input name="colorText" defaultValue={tag.color || "#7187f3"} readOnly />
            </div>
            <FieldError message={state.fieldErrors.color?.[0]} />
          </label>
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{text.cancel}</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isPending ? text.saving : text.save}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function TagDeleteDialog({ locale, tag }: { locale: Locale; tag: TagRow }) {
  const router = useRouter();
  const text = copy(locale);
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState<TagActionState, FormData>(deleteTagAction, initialState);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [router, state.ok]);

  return (
    <>
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        <Trash2 className="mr-2 h-4 w-4" />
        {text.delete}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={text.deleteTitle}
        description={text.deleteDescription}
      >
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={tag.id} />
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{tag.name}</p>
            <p className="mt-1">/{tag.slug}</p>
          </div>
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{text.cancel}</Button>
            <Button type="submit" variant="danger" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isPending ? text.deleting : text.delete}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function TagManager({ locale, tags }: { locale: Locale; tags: TagRow[] }) {
  const router = useRouter();
  const text = copy(locale);
  const [state, action, isPending] = useActionState<TagActionState, FormData>(createTagAction, initialState);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [router, state.ok]);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <form action={action} className="grid gap-4 md:grid-cols-[1.2fr_1fr_120px_auto] md:items-end">
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.name}</span>
            <Input name="name" placeholder={text.name} />
            <FieldError message={state.fieldErrors.name?.[0]} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.slug}</span>
            <Input name="slug" placeholder="optional-slug" />
            <FieldError message={state.fieldErrors.slug?.[0]} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">{text.color}</span>
            <Input name="color" type="color" defaultValue="#7187f3" className="h-11 p-1" />
            <FieldError message={state.fieldErrors.color?.[0]} />
          </label>
          <Button type="submit" disabled={isPending} className="w-full md:w-auto">
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            {isPending ? text.creating : text.create}
          </Button>
        </form>
        {state.message ? (
          <p className={state.ok ? "mt-3 text-sm text-emerald-600" : "mt-3 text-sm text-destructive"}>{state.message}</p>
        ) : null}
      </Card>

      {tags.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tags.map((tag) => (
            <Card key={tag.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full border border-black/10"
                      style={{ backgroundColor: tag.color || "#7187f3" }}
                    />
                    <p className="truncate font-medium">{tag.name}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">/{tag.slug}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  {tag.articleCount} {text.articles}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <TagEditDialog locale={locale} tag={tag} />
                <TagDeleteDialog locale={locale} tag={tag} />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center text-sm text-muted-foreground">{text.empty}</Card>
      )}
    </div>
  );
}
