"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ThemedCheckbox } from "@/components/ui/themed-checkbox";
import { createGuestbookMessageAction, type GuestbookActionState } from "@/features/guestbook/actions";
import type { Locale } from "@/lib/i18n-messages";

const initialState: GuestbookActionState = {
  ok: false,
  message: "",
  fieldErrors: {}
};

function copy(locale: Locale) {
  return locale === "en"
    ? {
        nickname: "Nickname",
        email: "Email",
        content: "What would you like to say?",
        notifyOnly: "Send only to the owner",
        notifyOnlyDescription: "This message will not be shown publicly and will be sent directly to the admin mailbox.",
        submitting: "Submitting...",
        submit: "Submit message"
      }
    : {
        nickname: "昵称",
        email: "邮箱",
        content: "想说的话",
        notifyOnly: "仅发送给站主",
        notifyOnlyDescription: "勾选后这条留言不会在前台公开展示，会直接发送到管理员邮箱。",
        submitting: "提交中...",
        submit: "提交留言"
      };
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

export function GuestbookForm({
  defaultNickname = "",
  defaultEmail = "",
  locale
}: {
  defaultNickname?: string;
  defaultEmail?: string;
  locale: Locale;
}) {
  const text = copy(locale);
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
      <Input name="nickname" placeholder={text.nickname} required maxLength={32} defaultValue={defaultNickname} />
      <FieldError messages={state.fieldErrors.nickname} />
      <Input name="email" type="email" placeholder={text.email} required defaultValue={defaultEmail} />
      <FieldError messages={state.fieldErrors.email} />
      <Textarea name="content" placeholder={text.content} required maxLength={1000} />
      <FieldError messages={state.fieldErrors.content} />
      <ThemedCheckbox
        name="notifyOnly"
        value="true"
        label={text.notifyOnly}
        description={text.notifyOnlyDescription}
      />
      <FieldError messages={state.fieldErrors.notifyOnly} />
      {state.message ? (
        <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? text.submitting : text.submit}
      </Button>
    </form>
  );
}
