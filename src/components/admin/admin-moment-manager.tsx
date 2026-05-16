"use client";

/* eslint-disable @next/next/no-img-element */

import { useActionState, useEffect, useState } from "react";
import { ContentVisibility } from "@prisma/client";
import { Calendar, Eye, ImagePlus, Loader2, MessageSquare, Pencil, Pin, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { MultiImageUploadField } from "@/components/forms/multi-image-upload-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ThemedCheckbox } from "@/components/ui/themed-checkbox";
import { createMomentAction, deleteMomentAction, updateMomentAction, type MomentActionState } from "@/features/moments/actions";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

type AdminMomentRow = {
  id: string;
  content: string;
  images: string[];
  visibility: ContentVisibility;
  pinned: boolean;
  createdAtLabel: string;
  createdAtIso: string;
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
        createdAt: "Publish date",
        createdAtHint: "Leave empty to use current time. Set for importing historical records.",
        publish: "Publish",
        publishing: "Publishing...",
        save: "Save",
        saving: "Saving...",
        delete: "Delete",
        deleting: "Deleting...",
        cancel: "Cancel",
        empty: "No moments yet.",
        deleteDescription: "The moment will be hidden from the public site and the admin list.",
        images: "Images",
        pinnedLabel: "Pinned",
        publicLabel: "Public"
      }
    : {
        createTitle: "发布瞬间",
        createDescription: "写一条短动态，上传图片，设置可见范围和发布时间。",
        editTitle: "编辑瞬间",
        deleteTitle: "删除瞬间",
        content: "内容",
        visibility: "可见范围",
        pinned: "置顶",
        createdAt: "发布时间",
        createdAtHint: "留空则使用当前时间，导入历史记录时可手动设置。",
        publish: "发布",
        publishing: "发布中...",
        save: "保存",
        saving: "保存中...",
        delete: "删除",
        deleting: "删除中...",
        cancel: "取消",
        empty: "暂时没有瞬间。",
        deleteDescription: "删除后该瞬间会从前台和后台列表中隐藏。",
        images: "图片",
        pinnedLabel: "已置顶",
        publicLabel: "公开"
      };
}

function visibilityOptions(locale: Locale) {
  const labels =
    locale === "en"
      ? {
          [ContentVisibility.PUBLIC]: "Public",
          [ContentVisibility.LOGIN_REQUIRED]: "Login required",
          [ContentVisibility.SVIP_ONLY]: "SVIP and above",
          [ContentVisibility.SSVIP_ONLY]: "SSVIP and above",
          [ContentVisibility.Administer_ONLY]: "Administer only"
        }
      : {
          [ContentVisibility.PUBLIC]: "公开",
          [ContentVisibility.LOGIN_REQUIRED]: "登录后可看",
          [ContentVisibility.SVIP_ONLY]: "SVIP 及以上",
          [ContentVisibility.SSVIP_ONLY]: "SSVIP 及以上",
          [ContentVisibility.Administer_ONLY]: "Administer 可见"
        };

  return Object.values(ContentVisibility).map((value) => ({
    value,
    label: labels[value]
  }));
}

function visibilityBadge(locale: Locale, visibility: ContentVisibility) {
  const map = visibilityOptions(locale);
  const found = map.find((opt) => opt.value === visibility);
  const label = found?.label ?? visibility;
  const colors: Record<string, string> = {
    [ContentVisibility.PUBLIC]: "bg-emerald-500/10 text-emerald-600",
    [ContentVisibility.LOGIN_REQUIRED]: "bg-sky-500/10 text-sky-600",
    [ContentVisibility.SVIP_ONLY]: "bg-violet-500/10 text-violet-600",
    [ContentVisibility.SSVIP_ONLY]: "bg-amber-500/10 text-amber-600",
  };
  const color = colors[visibility as string] ?? "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs", color)}>
      <Eye className="h-3 w-3" />
      {label}
    </span>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

function MomentFormFields({
  locale,
  defaultValues,
  compact
}: {
  locale: Locale;
  defaultValues?: { content?: string; images?: string[]; visibility?: ContentVisibility; pinned?: boolean; createdAt?: string };
  compact?: boolean;
}) {
  const copy = text(locale);
  return (
    <>
      <label className="block space-y-2 text-sm">
        <span className="font-medium">{copy.content}</span>
        <Textarea name="content" defaultValue={defaultValues?.content} placeholder={copy.content} required />
      </label>
      <div className="space-y-2">
        <span className="text-sm font-medium">{copy.images}</span>
        <MultiImageUploadField name="images" defaultValue={defaultValues?.images ?? []} locale={locale} />
      </div>
      <div className={compact ? "grid gap-4 sm:grid-cols-2" : "space-y-4"}>
        <label className="block space-y-2 text-sm">
          <span className="font-medium">{copy.visibility}</span>
          <Select
            name="visibility"
            defaultValue={defaultValues?.visibility ?? ContentVisibility.PUBLIC}
            options={visibilityOptions(locale)}
          />
        </label>
        <label className="block space-y-2 text-sm">
          <span className="font-medium">{copy.createdAt}</span>
          <Input
            name="createdAt"
            type="datetime-local"
            defaultValue={defaultValues?.createdAt ?? ""}
          />
          <p className="text-xs text-muted-foreground">{copy.createdAtHint}</p>
        </label>
      </div>
      <ThemedCheckbox
        name="pinned"
        defaultChecked={defaultValues?.pinned ?? false}
        label={copy.pinned}
      />
    </>
  );
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
      <Button type="button" variant="ghost" onClick={() => setOpen(true)} title={copy.editTitle}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={copy.editTitle} description={moment.createdAtLabel}>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={moment.id} />
          <MomentFormFields
            locale={locale}
            defaultValues={{
              content: moment.content,
              images: moment.images,
              visibility: moment.visibility,
              pinned: moment.pinned,
              createdAt: moment.createdAtIso
            }}
          />
          <FieldError message={state.fieldErrors.content?.[0]} />
          <FieldError message={state.fieldErrors.visibility?.[0]} />
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
      <Button type="button" variant="ghost" onClick={() => setOpen(true)} title={copy.delete}>
        <Trash2 className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={copy.deleteTitle} description={copy.deleteDescription}>
        <form action={action} className="space-y-4">
          <input type="hidden" name="id" value={momentId} />
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-muted-foreground line-clamp-3">
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
  const [createOpen, setCreateOpen] = useState(false);
  const [state, action, isPending] = useActionState<MomentActionState, FormData>(createMomentAction, initialState);

  useEffect(() => {
    if (state.ok) {
      setCreateOpen(false);
      router.refresh();
    }
  }, [router, state.ok]);

  return (
    <div className="space-y-6">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">瞬间</h1>
          <p className="mt-1 text-sm text-muted-foreground">{copy.createDescription}</p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Send className="mr-2 h-4 w-4" />
          {copy.publish}
        </Button>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen} title={copy.createTitle}>
        <form action={action} className="space-y-4">
          <MomentFormFields locale={locale} />
          <FieldError message={state.fieldErrors.content?.[0]} />
          <FieldError message={state.fieldErrors.visibility?.[0]} />
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>{copy.cancel}</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isPending ? copy.publishing : copy.publish}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Moments list */}
      {moments.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {moments.map((moment) => (
            <Card key={moment.id} className="group flex flex-col transition-shadow hover:shadow-md">
              <CardContent className="flex-1 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {moment.pinned ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">
                        <Pin className="h-3 w-3" />
                        {copy.pinnedLabel}
                      </span>
                    ) : null}
                    {visibilityBadge(locale, moment.visibility)}
                  </div>
                  <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <MomentEditDialog locale={locale} moment={moment} />
                    <MomentDeleteDialog locale={locale} momentId={moment.id} preview={moment.content.slice(0, 80)} />
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{moment.content}</p>
                {moment.images.length ? (
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {moment.images.slice(0, 6).map((image) => (
                      <img
                        key={image}
                        src={image}
                        alt=""
                        className="aspect-square rounded-md object-cover ring-1 ring-border/50"
                      />
                    ))}
                    {moment.images.length > 6 ? (
                      <div className="flex aspect-square items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
                        +{moment.images.length - 6}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
              <div className="flex items-center gap-3 border-t px-5 py-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {moment.createdAtLabel}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {moment.authorName}
                </span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed py-16 text-center">
          <ImagePlus className="mx-auto h-8 w-8 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">{copy.empty}</p>
        </Card>
      )}
    </div>
  );
}
