"use client";

import { useState } from "react";
import { UserRole } from "@prisma/client";
import { IdentityForm } from "@/components/admin/identity-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import type { PermissionDefinition } from "@/lib/permission-definitions";
import { roleLabels } from "@/lib/role-labels";

type IdentityValue = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  builtInRole: UserRole | null;
  permissions: string[];
  userCount: number;
};

export function IdentityManager({
  identities,
  permissionGroups
}: {
  identities: IdentityValue[];
  permissionGroups: Array<{ group: string; permissions: PermissionDefinition[] }>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = identities.find((identity) => identity.id === editingId);
  const getDisplayName = (identity: IdentityValue) =>
    identity.builtInRole ? roleLabels[identity.builtInRole] : identity.name;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">身份列表</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            可见身份固定为 user、svip 和 ssvip。隐藏的最高系统等级统一显示为 Administer，不在这里分配。
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        {identities.length ? (
          identities.map((identity) => (
            <div
              key={identity.id}
              className="grid gap-4 border-b p-4 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{getDisplayName(identity)}</p>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{identity.key}</span>
                  {identity.builtInRole ? (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                      {roleLabels[identity.builtInRole]}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {identity.description || "暂未填写说明。"} · {identity.userCount} 个用户
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => setEditingId(identity.id)}>
                  编辑权限
                </Button>
              </div>
            </div>
          ))
        ) : (
          <Card className="m-4 p-8 text-center text-sm text-muted-foreground">暂无可见身份。</Card>
        )}
      </div>

      <Dialog
        open={Boolean(editing)}
        title={editing ? `编辑身份：${getDisplayName(editing)}` : "编辑身份"}
        description="这里只允许调整可见身份的说明和权限矩阵。隐藏的 Administer 等级仍由服务端单独保护。"
        onOpenChange={(open) => {
          if (!open) {
            setEditingId(null);
          }
        }}
        className="max-w-5xl"
      >
        {editing ? <IdentityForm identity={editing} permissionGroups={permissionGroups} compact /> : null}
      </Dialog>
    </div>
  );
}
