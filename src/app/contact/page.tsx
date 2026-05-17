import { ExternalLink, Github, Globe, Mail, MessageCircle } from "lucide-react";
import { MotionItem, MotionList, MotionPage } from "@/components/animations/reveal";
import { PublicShell } from "@/components/layout/public-shell";
import { Card } from "@/components/ui/card";
import { parseContactItems, type ContactItem } from "@/features/settings/contact-items";
import { getSettingsMap } from "@/features/settings/service";
import { getCurrentLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

function pageText(locale: "zh-CN" | "en") {
  return locale === "en"
    ? {
        title: "Contact",
        description: "Public contact methods configured in the admin footer settings appear here.",
        empty: "No contact methods configured yet."
      }
    : {
        title: "联系方式",
        description: "这里展示后台页脚设置中公开的联系方式。",
        empty: "暂未配置联系方式。"
      };
}

function getIcon(contact: ContactItem) {
  switch (contact.kind) {
    case "email":
      return Mail;
    case "github":
      return Github;
    case "website":
      return Globe;
    default:
      return MessageCircle;
  }
}

function getHref(contact: ContactItem) {
  if (!contact.href?.trim()) {
    return contact.kind === "email" ? `mailto:${contact.value}` : contact.value;
  }

  return contact.href;
}

export default async function ContactPage() {
  const [locale, { settings, error }] = await Promise.all([getCurrentLocale(), getSettingsMap()]);
  const copy = pageText(locale);
  const contacts = parseContactItems(settings)
    .filter((item) => item.enabled)
    .sort((left, right) => left.sort - right.sort);

  return (
    <PublicShell>
      <MotionPage>
        <main className="mx-auto max-w-5xl px-6 py-12">
          <h1 className="text-4xl font-semibold">{copy.title}</h1>
          <p className="mt-3 text-muted-foreground">{copy.description}</p>
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

          <MotionList className="mt-8 grid gap-4 md:grid-cols-2">
            {contacts.length ? (
              contacts.map((contact) => {
                const Icon = getIcon(contact);
                return (
                  <MotionItem key={contact.id}>
                    <a
                      href={getHref(contact)}
                      target={contact.kind === "email" ? undefined : "_blank"}
                      rel={contact.kind === "email" ? undefined : "noopener noreferrer"}
                    >
                      <Card className="flex items-center gap-4 p-5">
                        <Icon className="h-5 w-5 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-muted-foreground">{contact.label}</p>
                          <p className="break-all font-medium">{contact.value}</p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </Card>
                    </a>
                  </MotionItem>
                );
              })
            ) : (
              <Card className="p-8 text-muted-foreground">{copy.empty}</Card>
            )}
          </MotionList>
        </main>
      </MotionPage>
    </PublicShell>
  );
}
