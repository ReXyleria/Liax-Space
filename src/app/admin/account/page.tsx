import { AccountWorkspace } from "@/components/account/account-workspace";
import { getAccountData } from "@/features/account/service";
import { requireAdminAccess } from "@/lib/admin-guard";
import { getAdminLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  const [user, locale] = await Promise.all([
    requireAdminAccess("/admin/account"),
    getAdminLocale()
  ]);
  const { sessions, passkeys, trustedDevices, error } = await getAccountData(user);

  return (
    <AccountWorkspace
      user={{
        nickname: user.nickname,
        avatar: user.avatar,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        totpEnabled: user.totpEnabled
      }}
      sessions={sessions.map((session) => ({
        id: session.id,
        deviceName: session.deviceName,
        createdAt: session.createdAt.toISOString(),
        lastUsedAt: session.lastUsedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString()
      }))}
      passkeys={passkeys.map((passkey) => ({
        id: passkey.id,
        deviceName: passkey.deviceName,
        createdAt: passkey.createdAt.toISOString(),
        lastUsedAt: passkey.lastUsedAt?.toISOString() ?? null
      }))}
      trustedDevices={trustedDevices.map((device) => ({
        id: device.id,
        deviceName: device.deviceName,
        createdAt: device.createdAt.toISOString(),
        lastUsedAt: device.lastUsedAt.toISOString(),
        expiresAt: device.expiresAt.toISOString()
      }))}
      error={error}
      locale={locale}
    />
  );
}
