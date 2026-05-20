import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const redirectMap: Record<string, string> = {
  basic: "/console/settings/basic",
  home: "/console/settings/homepage",
  homepage: "/console/settings/homepage",
  "nav-footer": "/console/settings/footer",
  footer: "/console/settings/footer",
  code: "/console/settings/code-injection",
  "code-injection": "/console/settings/code-injection",
  smtp: "/console/mail/smtp",
  mail: "/console/mail/templates",
  backup: "/console/data/backups",
  "import-export": "/console/data/backups",
  security: "/console/settings/security",
  translation: "/console/settings/translation"
};

export default async function ConsoleSettingsRedirectPage({
  searchParams
}: {
  searchParams?: Promise<{ tab?: string; view?: string }>;
}) {
  const params = (await searchParams) ?? {};

  if (params.tab === "mail" && params.view === "logs") {
    redirect("/console/mail/logs");
  }

  redirect(redirectMap[params.tab ?? "basic"] ?? "/console/settings/basic");
}
