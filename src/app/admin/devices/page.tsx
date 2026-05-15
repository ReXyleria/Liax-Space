import { DeviceRevokeButton } from "@/components/admin/device-revoke-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { revokeTrustedDeviceFormAction, revokeUserSessionFormAction } from "@/features/users/actions";
import { listAllLoginSessions, listAllTrustedDevices } from "@/features/users/service";
import { requireAdminPermission } from "@/lib/admin-guard";
import { canManageUsers } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDevicesPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const user = await requireAdminPermission(canManageUsers, "/admin/devices");
  const { sessions, error } = await listAllLoginSessions(user, params.q ?? "");
  const { devices, error: trustedError } = await listAllTrustedDevices(user, params.q ?? "");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">用户</p>
        <h1 className="text-3xl font-semibold">设备管理</h1>
        <p className="mt-2 text-muted-foreground">
          查看全站登录会话并撤销异常设备。设备标签经过简化，不展示完整 user agent 或敏感 IP。
        </p>
      </div>
      <form className="grid gap-2 md:grid-cols-[1fr_auto]">
        <Input name="q" placeholder="搜索邮箱、用户名或昵称" defaultValue={params.q ?? ""} />
        <Button>搜索</Button>
      </form>
      {error ? <Card className="p-5 text-destructive">{error}</Card> : null}
      {trustedError ? <Card className="p-5 text-destructive">{trustedError}</Card> : null}
      <Card className="overflow-hidden">
        {sessions.length ? (
          <div className="divide-y">
            {sessions.map((session) => (
              <div key={session.id} className="grid gap-3 p-5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="font-medium">{session.user.nickname}</p>
                  <p className="text-sm text-muted-foreground">
                    {session.user.email} · {session.user.role}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {session.deviceName || "未知设备"} · 最近使用 {formatDate(session.lastUsedAt)} · 过期 {formatDate(session.expiresAt)}
                  </p>
                </div>
                <DeviceRevokeButton
                  id={session.id}
                  label="撤销会话"
                  title="确认撤销会话"
                  description="该登录会话会立即失效，对应用户需要重新登录。"
                  action={revokeUserSessionFormAction}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">暂无登录会话。</div>
        )}
      </Card>
      <Card className="overflow-hidden">
        {devices.length ? (
          <div className="divide-y">
            {devices.map((device) => (
              <div key={device.id} className="grid gap-3 p-5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="font-medium">{device.user.nickname}</p>
                  <p className="text-sm text-muted-foreground">
                    {device.user.email} · {device.user.role}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {device.deviceName || "未知设备"} · 最近使用 {formatDate(device.lastUsedAt)} · 过期 {formatDate(device.expiresAt)}
                  </p>
                </div>
                <DeviceRevokeButton
                  id={device.id}
                  label="撤销信任设备"
                  title="确认撤销信任设备"
                  description="该设备之后不能再跳过二次验证，需要重新完成信任流程。"
                  action={revokeTrustedDeviceFormAction}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">暂无信任设备。</div>
        )}
      </Card>
    </div>
  );
}
