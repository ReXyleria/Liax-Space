"use client";

import { useActionState } from "react";
import { CommentStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { updateCommentStatusAction, type CommentActionState } from "@/features/comments/actions";

const initialState: CommentActionState = { ok: false, message: "" };
const commentStatusLabels: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  HIDDEN: "隐藏",
  DELETED: "已删除"
};

export function CommentStatusForm({ id, status }: { id: string; status: CommentStatus }) {
  const [state, formAction, isPending] = useActionState<CommentActionState, FormData>(
    updateCommentStatusAction,
    initialState
  );

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <Select
        name="status"
        defaultValue={status}
        className="min-w-40"
        options={Object.values(CommentStatus).map((item) => ({ value: item, label: commentStatusLabels[item] ?? item }))}
      />
      <Button type="submit" disabled={isPending}>{isPending ? "更新中..." : "更新"}</Button>
      {state.message ? (
        <p className={state.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"}>{state.message}</p>
      ) : null}
    </form>
  );
}
