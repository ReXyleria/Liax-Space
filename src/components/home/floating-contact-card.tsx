"use client";

import { ExternalLink, Github, Globe, Mail, MessageCircle } from "lucide-react";
import type { ContactItem } from "@/features/settings/contact-items";
import type { Locale } from "@/lib/i18n-messages";
import { Card } from "@/components/ui/card";

function text(locale: Locale) {
  return locale === "en"
    ? { title: "Contact", empty: "No contact methods configured yet." }
    : { title: "联系方式", empty: "暂未配置联系方式。" };
}

function ContactIcon({ kind }: { kind: ContactItem["kind"] }) {
  switch (kind) {
    case "email":
      return <Mail className="mt-0.5 h-4 w-4 shrink-0 text-white/76" />;
    case "github":
      return <Github className="mt-0.5 h-4 w-4 shrink-0 text-white/76" />;
    case "website":
      return <Globe className="mt-0.5 h-4 w-4 shrink-0 text-white/76" />;
    default:
      return <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-white/76" />;
  }
}

function getDisplayHref(contact: ContactItem) {
  if (!contact.href?.trim()) {
    return contact.kind === "email" ? `mailto:${contact.value}` : contact.value;
  }

  return contact.href;
}

export function FloatingContactCard({
  contacts,
  locale
}: {
  contacts: ContactItem[];
  locale: Locale;
}) {
  const copy = text(locale);
  const visibleContacts = contacts
    .filter((contact) => contact.enabled)
    .sort((left, right) => left.sort - right.sort);

  if (!visibleContacts.length) {
    return null;
  }

  return (
    <div className="mt-8 w-full max-w-sm justify-self-end lg:mt-0">
      <Card className="border-white/16 bg-white/14 p-5 text-white shadow-2xl shadow-black/20 backdrop-blur-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{copy.title}</h2>
          <ExternalLink className="h-4 w-4 text-blue-100" />
        </div>
        <div className="space-y-2">
          {visibleContacts.map((contact) => (
            <a
              key={contact.id}
              href={getDisplayHref(contact)}
              target={contact.kind === "email" ? undefined : "_blank"}
              rel={contact.kind === "email" ? undefined : "noopener noreferrer"}
              className="flex items-start gap-3 rounded-md border border-white/12 bg-white/10 p-3 transition hover:bg-white/18"
            >
              <ContactIcon kind={contact.kind} />
              <div className="min-w-0">
                <p className="text-xs text-white/58">{contact.label}</p>
                <p className="break-all text-sm">{contact.value}</p>
              </div>
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}
