import { DeviceRevokeButton } from "@/components/console/device-revoke-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { revokeTrustedDeviceFormAction, revokeUserSessionFormAction } from "@/features/users/actions";
import { listAllLoginSessions, listAllTrustedDevices } from "@/features/users/service";
import { requireConsolePermission } from "@/lib/console-guard";
import { t } from "@/lib/i18n";
import { getConsoleLocale } from "@/lib/i18n-server";
import { canManageUsers } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ConsoleDevicesPage({
  searchParams
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const [user, locale] = await Promise.all([
    requireConsolePermission(canManageUsers, "/console/devices"),
    getConsoleLocale()
  ]);
  const { sessions, error } = await listAllLoginSessions(user, params.q ?? "");
  const { devices, error: trustedError } = await listAllTrustedDevices(user, params.q ?? "");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{t(locale, "consoleDeviceManagement")}</h1>
        <p className="mt-2 text-muted-foreground">{t(locale, "consoleDeviceDescription")}</p>
      </div>
      <form className="grid gap-2 md:grid-cols-[1fr_auto]">
        <Input name="q" placeholder={t(locale, "consoleDeviceSearchPlaceholder")} defaultValue={params.q ?? ""} />
        <Button>{t(locale, "consoleDeviceSearch")}</Button>
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
                    {session.deviceName || t(locale, "consoleDeviceUnknownDevice")} · {locale === "en" ? "Last used" : "最近使用"} {formatDate(session.lastUsedAt)} · {locale === "en" ? "Expires" : "过期"} {formatDate(session.expiresAt)}
                  </p>
                </div>
                <DeviceRevokeButton
                  id={session.id}
                  label={t(locale, "consoleDeviceRevokeSession")}
                  title={t(locale, "consoleDeviceConfirmRevokeSession")}
                  description={t(locale, "consoleDeviceRevokeSessionDescription")}
                  action={revokeUserSessionFormAction}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">{t(locale, "consoleDeviceNoSessions")}</div>
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
                    {device.deviceName || t(locale, "consoleDeviceUnknownDevice")} · {locale === "en" ? "Last used" : "最近使用"} {formatDate(device.lastUsedAt)} · {locale === "en" ? "Expires" : "过期"} {formatDate(device.expiresAt)}
                  </p>
                </div>
                <DeviceRevokeButton
                  id={device.id}
                  label={t(locale, "consoleDeviceRevokeTrustedDevice")}
                  title={t(locale, "consoleDeviceConfirmRevokeTrustedDevice")}
                  description={t(locale, "consoleDeviceRevokeTrustedDeviceDescription")}
                  action={revokeTrustedDeviceFormAction}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">{t(locale, "consoleDeviceNoTrustedDevices")}</div>
        )}
      </Card>
    </div>
  );
}
