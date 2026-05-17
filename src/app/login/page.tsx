import { redirect } from "next/navigation";
import { LoginForm } from "@/components/forms/auth-forms";
import { SiteBackground, resolveSiteBackground } from "@/components/layout/site-background";
import { getSettingsMap } from "@/features/settings/service";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ callbackUrl?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const callbackUrl =
    params.callbackUrl && params.callbackUrl.startsWith("/") && !params.callbackUrl.startsWith("//")
      ? params.callbackUrl
      : "/admin";
  const [locale, { settings }, user] = await Promise.all([getCurrentLocale(), getSettingsMap(), getCurrentUser()]);

  if (user) {
    redirect(callbackUrl === "/login" ? "/admin" : callbackUrl);
  }

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center px-6 py-12">
      <SiteBackground src={resolveSiteBackground(settings)} variant="auth" />
      <LoginForm callbackUrl={callbackUrl} locale={locale} />
    </main>
  );
}
