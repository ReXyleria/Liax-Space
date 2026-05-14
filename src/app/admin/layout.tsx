import { AdminShell } from "@/components/admin/admin-shell";
import { resolveSiteBackground } from "@/components/layout/site-background";
import { getSettingsMap } from "@/features/settings/service";
import { requireAdminAccess } from "@/lib/admin-guard";
import { getAdminLocale } from "@/lib/i18n";
import { getSiteTitle } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, locale, siteTitle, { settings }] = await Promise.all([
    requireAdminAccess("/admin"),
    getAdminLocale(),
    getSiteTitle(),
    getSettingsMap()
  ]);

  return (
    <AdminShell
      user={user}
      locale={locale}
      siteTitle={siteTitle}
      backgroundImage={resolveSiteBackground(settings)}
    >
      {children}
    </AdminShell>
  );
}
