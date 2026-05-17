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
import { getAdminLocale, t } from "@/lib/i18n";
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
  const [user, locale] = await Promise.all([
    requireAdminPermission(canManageUsers, "/admin/users"),
    getAdminLocale()
  ]);
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
          <h1 className="text-3xl font-semibold">{t(locale, "adminUserManagement")}</h1>
          <p className="mt-2 text-muted-foreground">{t(locale, "adminUserDescription")}</p>
        </div>
        <CreateUserDialog identities={identities} currentUserRole={user.role} />
      </div>
      <form className="grid gap-2 md:grid-cols-[1fr_180px_220px_auto]">
        <Input name="q" placeholder={t(locale, "adminUserSearchPlaceholder")} defaultValue={params.q ?? ""} />
        <Select
          name="status"
          defaultValue={params.status ?? ""}
          options={[
            { value: "", label: t(locale, "adminUserAllStatus") },
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
            { value: "", label: t(locale, "adminUserAllIdentity") },
            ...identities.map((identity) => ({
              value: identity.id,
              label: identity.name
            }))
          ]}
        />
        <Button>{t(locale, "adminUserSearch")}</Button>
      </form>
      {error ? (
        <Card className="flex items-center justify-between gap-4 border-destructive/20 bg-destructive/5 p-5">
          <div>
            <p className="font-medium text-destructive">{t(locale, "adminUserLoadFailed")}</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </div>
          <Link
            href="/admin/users"
            className="inline-flex h-10 items-center justify-center rounded-md border border-destructive/20 bg-background px-4 text-sm font-medium text-foreground transition-all hover:-translate-y-0.5 hover:border-destructive/30 hover:bg-muted"
          >
            {t(locale, "adminUserRetry")}
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
            <p className="text-sm text-muted-foreground">{t(locale, "adminUserNotFound")}</p>
            <p className="text-xs text-muted-foreground">{t(locale, "adminUserNotFoundHint")}</p>
          </div>
        )}
      </Card>
    </div>
  );
}