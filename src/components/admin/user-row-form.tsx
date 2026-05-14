"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { UserRole, UserStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  deleteUserAction,
  revokeUserSessionAction,
  updateUserAction,
  type UserActionState
} from "@/features/users/actions";
import { statusLabels } from "@/lib/role-labels";
import { roleLabels } from "@/lib/role-labels";

type IdentityOption = {
  id: string;
  name: string;
  key: string;
  builtInRole: UserRole | null;
};

type UserRow = {
  id: string;
  email: string;
  nickname: string;
  role: UserRole;
  identityId: string | null;
  identityName: string | null;
  status: UserStatus;
  createdAtLabel: string;
  lastLoginAtLabel: string;
  sessions: Array<{
    id: string;
    deviceName: string | null;
    lastUsedAtLabel: string;
    expiresAtLabel: string;
  }>;
};

const initialState: UserActionState = {
  ok: false,
  message: ""
};

function ActionMessage({ state }: { state: UserActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p className={state.ok ? "text-xs text-emerald-600" : "text-xs text-destructive"}>
      {state.message}
    </p>
  );
}

export function UserRowForm({
  user,
  identities
}: {
  user: UserRow;
  identities: IdentityOption[];
  currentUserRole: UserRole;
}) {
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedIdentityId, setSelectedIdentityId] = useState(user.identityId ?? "");
  const [saveState, saveAction, isSaving] = useActionState<UserActionState, FormData>(
    updateUserAction,
    initialState
  );
  const [sessionState, revokeAction, isRevoking] = useActionState<UserActionState, FormData>(
    revokeUserSessionAction,
    initialState
  );
  const [deleteState, deleteAction, isDeleting] = useActionState<UserActionState, FormData>(
    deleteUserAction,
    initialState
  );
  const formId = `user-settings-${user.id}`;
  const displayIdentity =
    user.role === UserRole.OWNER
      ? roleLabels[UserRole.OWNER]
      : user.identityName === "user"
        ? "普通读者"
        : user.identityName === "svip"
          ? "SVIP"
          : user.identityName === "ssvip"
            ? "SSVIP"
            : user.identityName ?? "默认身份";

  useEffect(() => {
    if (saveState.ok) {
      setDirty(false);
    }
  }, [saveState.ok]);

  useEffect(() => {
    if (deleteState.ok) {
      setDeleteOpen(false);
    }
  }, [deleteState.ok]);

  return (
    <div className="grid gap-4 p-5 transition hover:bg-muted/35 md:grid-cols-[1fr_auto]">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{user.nickname}</p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {displayIdentity}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          注册 {user.createdAtLabel} · 最近登录 {user.lastLoginAtLabel || "从未登录"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 md:justify-end">
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>设置</Button>
        <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>删除</Button>
      </div>

      <Dialog
        open={open}
        title="用户设置"
        description={`${user.nickname} · ${user.email}`}
        confirmOnClose={dirty}
        onOpenChange={setOpen}
        footer={
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-muted-foreground">
              身份是唯一可编辑的权限入口；系统安全等级由服务端根据身份自动维护。
            </p>
            <Button form={formId} type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isSaving ? "保存中..." : "保存设置"}
            </Button>
          </div>
        }
      >
        <form id={formId} action={saveAction} className="space-y-5" onChange={() => setDirty(true)}>
          <fieldset disabled={isSaving} className="space-y-5">
            <input type="hidden" name="id" value={user.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium">邮箱</span>
                <Input name="email" type="email" defaultValue={user.email} />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">昵称</span>
                <Input name="nickname" defaultValue={user.nickname} />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">重置密码</span>
                <Input name="password" type="password" placeholder="留空表示不修改" autoComplete="new-password" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">身份</span>
                <Select
                  name="identityId"
                  value={selectedIdentityId}
                  disabled={isSaving}
                  onValueChange={setSelectedIdentityId}
                  options={[
                    { value: "", label: "使用默认身份" },
                    ...identities.map((identity) => ({
                      value: identity.id,
                      label: `${identity.builtInRole ? roleLabels[identity.builtInRole] : identity.name} (${identity.key})`
                    }))
                  ]}
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium">状态</span>
                <Select
                  name="status"
                  defaultValue={user.status}
                  disabled={isSaving}
                  options={Object.values(UserStatus).map((status) => ({
                    value: status,
                    label: statusLabels[status]
                  }))}
                />
              </label>
            </div>
            <ActionMessage state={saveState} />
          </fieldset>
        </form>

        <div className="mt-6 rounded-md border bg-muted/35 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">登录设备</p>
            <ActionMessage state={sessionState} />
          </div>
          <div className="mt-3 space-y-2">
            {user.sessions.length ? user.sessions.map((session) => (
              <form key={session.id} action={revokeAction} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3 text-sm">
                <input type="hidden" name="id" value={session.id} />
                <div>
                  <p>{session.deviceName || "未知设备"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    最近使用 {session.lastUsedAtLabel} · 过期 {session.expiresAtLabel}
                  </p>
                </div>
                <Button type="submit" variant="secondary" disabled={isRevoking}>
                  {isRevoking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  撤销
                </Button>
              </form>
            )) : <p className="text-sm text-muted-foreground">暂无登录设备。</p>}
          </div>
        </div>
      </Dialog>
      <Dialog
        open={deleteOpen}
        title="删除用户"
        description={`${user.nickname} · ${user.email}`}
        onOpenChange={setDeleteOpen}
      >
        <form action={deleteAction} className="space-y-4">
          <input type="hidden" name="id" value={user.id} />
          <div className="rounded-lg border bg-destructive/5 p-4 text-sm text-muted-foreground">
            此操作会永久删除该用户及其文章、瞬间、评论、会话、安全凭据、可信设备，以及可安全删除的上传媒体。
          </div>
          <ActionMessage state={deleteState} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)}>取消</Button>
            <Button type="submit" variant="danger" disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isDeleting ? "删除中..." : "确认删除"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
