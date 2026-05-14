"use client";

import { useActionState } from "react";
import { UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemedCheckbox } from "@/components/ui/themed-checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  createIdentityAction,
  updateIdentityAction,
  type IdentityActionState
} from "@/features/identity/actions";
import type { PermissionDefinition } from "@/lib/permission-definitions";
import { roleLabels } from "@/lib/role-labels";

type IdentityFormValue = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  builtInRole: UserRole | null;
  permissions: string[];
  userCount: number;
};

const initialState: IdentityActionState = {
  ok: false,
  message: ""
};

function ActionMessage({ state }: { state: IdentityActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p className={state.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"}>
      {state.message}
    </p>
  );
}

export function IdentityForm({
  identity,
  permissionGroups,
  compact = false
}: {
  identity?: IdentityFormValue;
  permissionGroups: Array<{ group: string; permissions: PermissionDefinition[] }>;
  compact?: boolean;
}) {
  const action = identity
    ? updateIdentityAction.bind(null, identity.id)
    : createIdentityAction;
  const [state, formAction, isPending] = useActionState<IdentityActionState, FormData>(
    action,
    initialState
  );
  const fixedSystemIdentity = Boolean(identity?.builtInRole);
  const checkedPermissions = new Set(identity?.permissions ?? []);

  return (
    <div className={compact ? "" : "rounded-lg border bg-card p-5"}>
      <form action={formAction} className="space-y-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{identity ? identity.name : "新身份"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {identity?.builtInRole
                ? `系统等级：${roleLabels[identity.builtInRole]}`
                : "自定义权限身份。"}
            </p>
          </div>
          {identity ? (
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {identity.userCount} 个用户
            </span>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="font-medium">标识</span>
            <Input name="key" defaultValue={identity?.key ?? ""} disabled={Boolean(identity?.builtInRole)} />
            {identity?.builtInRole ? <input type="hidden" name="key" value={identity.key} /> : null}
            {state.fieldErrors?.key?.[0] ? <p className="text-xs text-destructive">{state.fieldErrors.key[0]}</p> : null}
          </label>
          <label className="space-y-2 text-sm">
            <span className="font-medium">名称</span>
            <Input name="name" defaultValue={identity?.name ?? ""} disabled={fixedSystemIdentity} />
            {fixedSystemIdentity ? <input type="hidden" name="name" value={identity?.name ?? ""} /> : null}
            {state.fieldErrors?.name?.[0] ? <p className="text-xs text-destructive">{state.fieldErrors.name[0]}</p> : null}
          </label>
        </div>

        <label className="space-y-2 text-sm">
          <span className="font-medium">说明</span>
          <Textarea name="description" defaultValue={identity?.description ?? ""} />
        </label>

        <div className="space-y-4">
          {permissionGroups.map((group) => (
            <div key={group.group} className="rounded-md border bg-muted/20 p-4">
              <p className="text-sm font-semibold">{group.group}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {group.permissions.map((permission) => {
                  const checked = checkedPermissions.has(permission.key);
                  return (
                    <ThemedCheckbox
                      key={permission.key}
                      name="permissions"
                      value={permission.key}
                      defaultChecked={checked}
                      label={permission.label}
                      description={permission.description}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <ActionMessage state={state} />
        <div className="flex items-center justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? "保存中..." : identity ? "保存身份" : "创建身份"}
          </Button>
        </div>
      </form>
    </div>
  );
}
