"use client";

/* eslint-disable @next/next/no-img-element */

import { useActionState, useEffect, useState } from "react";
import { ContentVisibility } from "@prisma/client";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { MultiImageUploadField } from "@/components/forms/multi-image-upload-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ThemedCheckbox } from "@/components/ui/themed-checkbox";
import { createMomentAction, deleteMomentAction, updateMomentAction, type MomentActionState } from "@/features/moments/actions";
import type { Locale } from "@/lib/i18n";

type AdminMomentRow = {
  id: string;
  content: string;
  images: string[];
  visibility: ContentVisibility;
  pinned: boolean;
  createdAtLabel: string;
  authorName: string;
};

const initialState: MomentActionState = { ok: false, message: "", fieldErrors: {} };

function text(locale: Locale) {
  return locale === "en"
    ? {
        createTitle: "Publish moment",
        createDescription: "Write a short update, add images, and set its visibility.",
        editTitle: "Edit moment",
        deleteTitle: "Delete moment",
        content: "Content",
        visibility: "Visibility",
        pinned: "Pinned",
        publish: "Publish",
        publishing: "Publishing...",
        save: "Save",
        saving: "Saving...",
        delete: "Delete",
        deleting: "Deleting...",
        cancel: "Cancel",
        empty: "No moments yet.",
        deleteDescription: "The moment will be hidden from the public site and the admin list.",
        images: "Images"
      }
    : {
        createTitle: "发布瞬间",
        createDescription: "写一条短动态，上传图片，并设置它的可见范围。",
        editTitle: "编辑瞬间",
        deleteTitle: "删除瞬间",
        content: "内容",
        visibility: "可见范围",
        pinned: "置顶",
        publish: "发布",
        publishing: "发布中...",
        save: "保存",
        saving: "保存中...",
        delete: "删除",
        deleting: "删除中...",
        cancel: "取消",
        empty: "暂时没有瞬间。",
        deleteDescription: "删除后该瞬间会从前台和后台列表中隐藏。",
        images: "图片"
      };
}

function visibilityOptions(locale: Locale) {
  const labels =
    locale === "en"
      ? {
          [ContentVisibility.PUBLIC]: "Public",
          [ContentVisibility.LOGIN_REQUIRED]: "Login required",
          [ContentVisibility.FRIEND_ONLY]: "SVIP and above",
          [ContentVisibility.VIP_ONLY]: "SSVIP and above",
          [ContentVisibility.EDITOR_ONLY]: "Editors and above",
          [ContentVisibility.ADMIN_ONLY]: "Admins only",
          [ContentVisibility.OWNER_ONLY]: "Administer only"
        }
      : {
          [ContentVisibility.PUBLIC]: "公开",
          [ContentVisibility.LOGIN_REQUIRED]: "登录后可见",
          [ContentVisibility.FRIEND_ONLY]: "SVIP 及以上",
          [ContentVisibility.VIP_ONLY]: "SSVIP 及以上",
          [ContentVisibility.EDITOR_ONLY]: "编辑及以上",
          [ContentVisibility.ADMIN_ONLY]: "管理员可见",
          [ContentVisibility.OWNER_ONLY]: "Administer 可见"
        };

  return Object.values(ContentVisibility).map((value) => ({
    value,
    label: labels[value]
  }));
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

function MomentEditDialog({ locale, moment }: { locale: Locale; moment: AdminMomentRow }) {
  const router = useRouter();
  const copy = text(locale);
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState<MomentActionState, FormData>(updateMomentAction, initialState);

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
        {copy.editTitle}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={copy.editTitle} description={moment.createdAtLabel}>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={moment.id} />
          <label className="block space-y-2 text-sm">
            <span className="font-medium">{copy.content}</span>
            <Textarea name="content" defaultValue={moment.content} required />
            <FieldError message={state.fieldErrors.content?.[0]} />
          </label>
          <div className="space-y-2">
            <span className="text-sm font-medium">{copy.images}</span>
            <MultiImageUploadField name="images" defaultValue={moment.images} locale={locale} />
            <FieldError message={state.fieldErrors.images?.[0]} />
          </div>
          <label className="block space-y-2 text-sm">
            <span className="font-medium">{copy.visibility}</span>
            <Select name="visibility" defaultValue={moment.visibility} options={visibilityOptions(locale)} />
            <FieldError message={state.fieldErrors.visibility?.[0]} />
          </label>
          <ThemedCheckbox name="pinned" defaultChecked={moment.pinned} label={copy.pinned} />
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{copy.cancel}</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isPending ? copy.saving : copy.save}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function MomentDeleteDialog({ locale, momentId, preview }: { locale: Locale; momentId: string; preview: string }) {
  const router = useRouter();
  const copy = text(locale);
  const [open, setOpen] = useState(false);
  const [state, action, isPending] = useActionState<MomentActionState, FormData>(deleteMomentAction, initialState);

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
        {copy.delete}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={copy.deleteTitle} description={copy.deleteDescription}>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={momentId} />
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-muted-foreground">
            {preview}
          </div>
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{copy.cancel}</Button>
            <Button type="submit" variant="danger" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isPending ? copy.deleting : copy.delete}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function AdminMomentManager({ locale, moments }: { locale: Locale; moments: AdminMomentRow[] }) {
  const router = useRouter();
  const copy = text(locale);
  const [state, action, isPending] = useActionState<MomentActionState, FormData>(createMomentAction, initialState);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [router, state.ok]);

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card className="p-5">
        <h1 className="text-2xl font-semibold">{copy.createTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.createDescription}</p>
        <form action={action} className="mt-5 space-y-4">
          <label className="block space-y-2 text-sm">
            <span className="font-medium">{copy.content}</span>
            <Textarea name="content" placeholder={copy.content} required />
            <FieldError message={state.fieldErrors.content?.[0]} />
          </label>
          <div className="space-y-2">
            <span className="text-sm font-medium">{copy.images}</span>
            <MultiImageUploadField name="images" locale={locale} />
            <FieldError message={state.fieldErrors.images?.[0]} />
          </div>
          <label className="block space-y-2 text-sm">
            <span className="font-medium">{copy.visibility}</span>
            <Select name="visibility" defaultValue={ContentVisibility.PUBLIC} options={visibilityOptions(locale)} />
            <FieldError message={state.fieldErrors.visibility?.[0]} />
          </label>
          <ThemedCheckbox name="pinned" label={copy.pinned} className="max-w-xs" />
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>
          ) : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isPending ? copy.publishing : copy.publish}
          </Button>
        </form>
      </Card>

      <div className="space-y-4">
        {moments.length ? (
          moments.map((moment) => (
            <Card key={moment.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="whitespace-pre-wrap">{moment.content}</p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {moment.authorName} · {visibilityOptions(locale).find((item) => item.value === moment.visibility)?.label} · {moment.createdAtLabel}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <MomentEditDialog locale={locale} moment={moment} />
                  <MomentDeleteDialog locale={locale} momentId={moment.id} preview={moment.content.slice(0, 80)} />
                </div>
              </div>
              {moment.images.length ? (
                <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3">
                  {moment.images.map((image) => (
                    <img key={image} src={image} alt="" className="h-28 rounded-md object-cover" />
                  ))}
                </div>
              ) : null}
            </Card>
          ))
        ) : (
          <Card className="p-8 text-muted-foreground">{copy.empty}</Card>
        )}
      </div>
    </div>
  );
}
