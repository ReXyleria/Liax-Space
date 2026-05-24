"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  Archive,
  Bell,
  Circle,
  Code2,
  DatabaseBackup,
  FileText,
  Fingerprint,
  HardDrive,
  Home,
  KeyRound,
  LayoutDashboard,
  Mail,
  MessageSquare,
  PanelBottom,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Tags,
  UserCircle,
  Users,
  Zap,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ConsoleNavIconKey =
  | "dashboard"
  | "articles"
  | "tags"
  | "moments"
  | "comments"
  | "archives"
  | "users"
  | "identity"
  | "devices"
  | "settings"
  | "homepage"
  | "footer"
  | "code"
  | "mail"
  | "templates"
  | "logs"
  | "media"
  | "backup"
  | "sitePush"
  | "account"
  | "security"
  | "totp"
  | "passkey"
  | "analytics"
  | "health";

export const iconMap: Record<ConsoleNavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  articles: FileText,
  tags: Tags,
  moments: Zap,
  comments: MessageSquare,
  archives: Archive,
  users: Users,
  identity: Fingerprint,
  devices: Smartphone,
  settings: Settings,
  homepage: Home,
  footer: PanelBottom,
  code: Code2,
  mail: Mail,
  templates: MessageSquare,
  logs: Bell,
  media: HardDrive,
  backup: DatabaseBackup,
  sitePush: Send,
  account: UserCircle,
  security: ShieldCheck,
  totp: KeyRound,
  passkey: Fingerprint,
  analytics: LayoutDashboard,
  health: Activity
};

export function ConsoleNavLink({
  href,
  label,
  description,
  iconKey
}: {
  href: string;
  label: string;
  description: string;
  iconKey: ConsoleNavIconKey;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.size ? `${pathname}?${searchParams.toString()}` : pathname;
  const isExact = current === href;
  const isSection = href !== "/console" && !href.includes("?") && pathname.startsWith(href);
  const isActive = isExact || isSection;
  const Icon = iconMap[iconKey] ?? Circle;

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-3 py-3 text-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-background/80 hover:text-foreground hover:shadow-sm active:translate-y-0 active:scale-[0.99]",
        isActive
          ? "border-primary/35 bg-primary/10 text-foreground shadow-sm"
          : "border-transparent text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-md transition-all",
          isActive
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{description}</span>
      </span>
    </Link>
  );
}
