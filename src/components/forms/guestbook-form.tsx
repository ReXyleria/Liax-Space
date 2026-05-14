"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createGuestbookMessageAction, type GuestbookActionState } from "@/features/guestbook/actions";

const initialState: GuestbookActionState = {
  ok: false,
  message: "",
  fieldErrors: {}
};

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

export function GuestbookForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<GuestbookActionState, FormData>(
    createGuestbookMessageAction,
    initialState
  );

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
    }
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="mt-6 space-y-3 rounded-lg border bg-card p-4">
      <Input name="nickname" placeholder="昵称" required maxLength={32} />
      <FieldError messages={state.fieldErrors.nickname} />
      <Input name="email" type="email" placeholder="邮箱" required />
      <FieldError messages={state.fieldErrors.email} />
      <Textarea name="content" placeholder="想说的话" required maxLength={1000} />
      <FieldError messages={state.fieldErrors.content} />
      {state.message ? (
        <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "提交中..." : "提交留言"}
      </Button>
    </form>
  );
}
