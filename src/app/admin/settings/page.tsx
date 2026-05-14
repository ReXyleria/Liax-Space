import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const redirectMap: Record<string, string> = {
  basic: "/admin/settings/basic",
  home: "/admin/settings/homepage",
  homepage: "/admin/settings/homepage",
  "nav-footer": "/admin/settings/footer",
  footer: "/admin/settings/footer",
  code: "/admin/settings/code-injection",
  "code-injection": "/admin/settings/code-injection",
  smtp: "/admin/mail/smtp",
  mail: "/admin/mail/templates",
  backup: "/admin/data/backups",
  "import-export": "/admin/data/backups",
  security: "/admin/settings/security",
  translation: "/admin/settings/translation"
};

export default async function AdminSettingsRedirectPage({
  searchParams
}: {
  searchParams?: Promise<{ tab?: string; view?: string }>;
}) {
  const params = (await searchParams) ?? {};

  if (params.tab === "mail" && params.view === "logs") {
    redirect("/admin/mail/logs");
  }

  redirect(redirectMap[params.tab ?? "basic"] ?? "/admin/settings/basic");
}
