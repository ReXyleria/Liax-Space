"use client";

import { useActionState } from "react";
import { GuestbookStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { moderateGuestbookMessageAction, type GuestbookActionState } from "@/features/guestbook/actions";

const initialState: GuestbookActionState = { ok: false, message: "", fieldErrors: {} };
const guestbookStatusLabels: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  HIDDEN: "隐藏",
  DELETED: "已删除"
};

export function GuestbookModerationForm({
  id,
  reply,
  status
}: {
  id: string;
  reply: string | null;
  status: GuestbookStatus;
}) {
  const [state, formAction, isPending] = useActionState<GuestbookActionState, FormData>(
    moderateGuestbookMessageAction,
    initialState
  );

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="id" value={id} />
      <Textarea name="reply" placeholder="站主回复" defaultValue={reply ?? ""} />
      {state.fieldErrors.reply?.[0] ? <p className="text-xs text-destructive">{state.fieldErrors.reply[0]}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          name="status"
          defaultValue={status}
          className="min-w-40"
          options={Object.values(GuestbookStatus).map((item) => ({ value: item, label: guestbookStatusLabels[item] ?? item }))}
        />
        <Button type="submit" disabled={isPending}>{isPending ? "保存中..." : "保存"}</Button>
        {state.message ? (
          <p className={state.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"}>{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
