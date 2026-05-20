"use client";

import { useActionState, useEffect, useState } from "react";
import { UserRole, UserStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ThemedCheckbox } from "@/components/ui/themed-checkbox";
import { createUserAction, type UserActionState } from "@/features/users/actions";
import { statusLabels } from "@/lib/role-labels";

type IdentityOption = {
  id: string;
  name: string;
  key: string;
  builtInRole: UserRole | null;
};

type Draft = {
  email: string;
  username: string;
  nickname: string;
  password: string;
  confirmPassword: string;
  identityId: string;
  status: string;
  sendWelcomeEmail: boolean;
};

const initialDraft: Draft = {
  email: "",
  username: "",
  nickname: "",
  password: "",
  confirmPassword: "",
  identityId: "",
  status: UserStatus.ACTIVE,
  sendWelcomeEmail: false
};

const initialState: UserActionState = { ok: false, message: "", fieldErrors: {}, values: {} };

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }
  return <p className="text-xs text-destructive">{messages[0]}</p>;
}

export function CreateUserDialog({ identities }: { identities: IdentityOption[]; currentUserRole: UserRole }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [state, action, isPending] = useActionState<UserActionState, FormData>(createUserAction, initialState);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.values && !state.ok) {
      setDraft((current) => ({
        ...current,
        email: state.values?.email ?? current.email,
        username: state.values?.username ?? current.username,
        nickname: state.values?.nickname ?? current.nickname,
        identityId: state.values?.identityId ?? "",
        status: state.values?.status ?? current.status,
        sendWelcomeEmail: state.values?.sendWelcomeEmail ?? current.sendWelcomeEmail
      }));
    }
  }, [state.ok, state.values]);

  useEffect(() => {
    if (state.ok) {
      setDraft(initialDraft);
      setOpen(false);
    }
  }, [state.ok]);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>新建用户</Button>
      <Dialog
        open={open}
        title="新建用户"
        description="创建后台账号并分配身份。系统安全等级由身份在服务端自动决定。"
        onOpenChange={setOpen}
      >
        <form action={action} noValidate className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium">邮箱</span>
              <Input
                name="email"
                type="email"
                value={draft.email}
                onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
              />
              <FieldError messages={errors.email} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">用户名</span>
              <Input
                name="username"
                value={draft.username}
                onChange={(event) => setDraft((current) => ({ ...current, username: event.target.value }))}
              />
              <FieldError messages={errors.username} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">昵称</span>
              <Input
                name="nickname"
                value={draft.nickname}
                onChange={(event) => setDraft((current) => ({ ...current, nickname: event.target.value }))}
              />
              <FieldError messages={errors.nickname} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">身份</span>
              <Select
                name="identityId"
                value={draft.identityId}
                onValueChange={(identityId) => setDraft((current) => ({ ...current, identityId }))}
                options={[
                  { value: "", label: "使用新用户默认身份" },
                  ...identities.map((identity) => ({
                    value: identity.id,
                    label: `${identity.name} (${identity.key})`
                  }))
                ]}
              />
              <FieldError messages={errors.identityId} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">初始密码</span>
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                value={draft.password}
                onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))}
              />
              <FieldError messages={errors.password} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">确认密码</span>
              <Input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={draft.confirmPassword}
                onChange={(event) => setDraft((current) => ({ ...current, confirmPassword: event.target.value }))}
              />
              <FieldError messages={errors.confirmPassword} />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium">状态</span>
              <Select
                name="status"
                value={draft.status}
                onValueChange={(status) => setDraft((current) => ({ ...current, status }))}
                options={Object.values(UserStatus).map((status) => ({
                  value: status,
                  label: statusLabels[status]
                }))}
              />
              <FieldError messages={errors.status} />
            </label>
          </div>

          <ThemedCheckbox
            name="sendWelcomeEmail"
            checked={draft.sendWelcomeEmail}
            onCheckedChange={(sendWelcomeEmail) => setDraft((current) => ({ ...current, sendWelcomeEmail }))}
            label="发送欢迎邮件"
            description="SMTP 未配置时不会阻止账号创建。"
          />
          {state.message ? (
            <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>{state.message}</p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>{isPending ? "创建中..." : "创建用户"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
