import Link from "next/link";
import { UserStatus } from "@prisma/client";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { UserRowForm } from "@/components/admin/user-row-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { listAssignableIdentities } from "@/features/identity/service";
import { listUsers } from "@/features/users/service";
import { requireAdminPermission } from "@/lib/admin-guard";
import { canManageUsers } from "@/lib/permissions";
import { statusLabels } from "@/lib/role-labels";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string; status?: string; identityId?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const user = await requireAdminPermission(canManageUsers, "/admin/users");
  const [{ users, error }, identities] = await Promise.all([
    listUsers(user, params.q ?? "", {
      status: params.status,
      identityId: params.identityId
    }),
    listAssignableIdentities(user)
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">用户管理</h1>
          <p className="mt-2 text-muted-foreground">
            搜索用户并按身份或状态筛选。身份是唯一可编辑的权限入口，系统安全等级由服务端自动维护。
          </p>
        </div>
        <CreateUserDialog identities={identities} currentUserRole={user.role} />
      </div>
      <form className="grid gap-2 md:grid-cols-[1fr_180px_220px_auto]">
        <Input name="q" placeholder="搜索邮箱、用户名或昵称" defaultValue={params.q ?? ""} />
        <Select
          name="status"
          defaultValue={params.status ?? ""}
          options={[
            { value: "", label: "全部状态" },
            ...Object.values(UserStatus).map((status) => ({
              value: status,
              label: statusLabels[status]
            }))
          ]}
        />
        <Select
          name="identityId"
          defaultValue={params.identityId ?? ""}
          options={[
            { value: "", label: "全部身份" },
            ...identities.map((identity) => ({
              value: identity.id,
              label: identity.name
            }))
          ]}
        />
        <Button>搜索</Button>
      </form>
      {error ? (
        <Card className="flex items-center justify-between gap-4 border-destructive/20 bg-destructive/5 p-5">
          <div>
            <p className="font-medium text-destructive">用户列表加载失败</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </div>
          <Link
            href="/admin/users"
            className="inline-flex h-10 items-center justify-center rounded-md border border-destructive/20 bg-background px-4 text-sm font-medium text-foreground transition-all hover:-translate-y-0.5 hover:border-destructive/30 hover:bg-muted"
          >
            重新加载
          </Link>
        </Card>
      ) : null}
      <Card className="overflow-hidden">
        {users.length ? (
          <div className="divide-y">
            {users.map((item) => (
              <UserRowForm
                key={item.id}
                identities={identities}
                currentUserRole={user.role}
                user={{
                  id: item.id,
                  email: item.email,
                  nickname: item.nickname,
                  role: item.role,
                  identityId: item.identityId,
                  identityName: item.identity?.name ?? null,
                  status: item.status,
                  createdAtLabel: formatDate(item.createdAt),
                  lastLoginAtLabel: formatDate(item.lastLoginAt),
                  sessions: item.sessions.map((session) => ({
                    id: session.id,
                    deviceName: session.deviceName,
                    lastUsedAtLabel: formatDate(session.lastUsedAt),
                    expiresAtLabel: formatDate(session.expiresAt)
                  }))
                }}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4 p-8 text-center">
            <p className="text-sm text-muted-foreground">没有找到用户。</p>
            <p className="text-xs text-muted-foreground">可以尝试调整筛选条件，或者点击右上角创建新用户。</p>
          </div>
        )}
      </Card>
    </div>
  );
}
