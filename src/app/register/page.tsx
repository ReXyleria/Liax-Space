import { RegisterForm } from "@/components/forms/auth-forms";
import { SiteBackground, resolveSiteBackground } from "@/components/layout/site-background";
import { getSettingsMap } from "@/features/settings/service";
import { getCurrentLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const [locale, { settings }] = await Promise.all([getCurrentLocale(), getSettingsMap()]);

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center px-6 py-12">
      <SiteBackground src={resolveSiteBackground(settings)} variant="auth" />
      <RegisterForm locale={locale} />
    </main>
  );
}
