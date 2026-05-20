import type { ConsoleNavIconKey } from "@/components/console/console-nav-link";

export type ConsoleNavVisibilityKey =
  | "always"
  | "analytics"
  | "articles"
  | "moments"
  | "comments"
  | "guestbook"
  | "users"
  | "identities"
  | "settings"
  | "codeInjection"
  | "mailTemplates"
  | "backups";

/** Icon-only key that safely serializes between server/client. */
export type ConsoleSidebarGroupKey =
  | "dashboard"
  | "content"
  | "appearance"
  | "users"
  | "system"
  | "tools"
  | "account";

export type ConsoleTabItem = {
  href: string;
  labelKey: string;
  iconKey: ConsoleNavIconKey;
  visibility: ConsoleNavVisibilityKey;
};

export type ConsoleSidebarGroup = {
  key: ConsoleSidebarGroupKey;
  labelKey: string;
  iconKey: ConsoleNavIconKey;
  basePath: string;
  tabs: ConsoleTabItem[];
};

export const consoleSidebarGroups: ConsoleSidebarGroup[] = [
  {
    key: "dashboard",
    labelKey: "consoleDashboard",
    iconKey: "dashboard",
    basePath: "/console",
    tabs: [
      {
        href: "/console",
        labelKey: "consoleConsole",
        iconKey: "dashboard",
        visibility: "analytics"
      }
    ]
  },
  {
    key: "content",
    labelKey: "consoleContent",
    iconKey: "articles",
    basePath: "/console",
    tabs: [
      { href: "/console/articles", labelKey: "articles", iconKey: "articles", visibility: "articles" },
      { href: "/console/tags", labelKey: "tags", iconKey: "tags", visibility: "articles" },
      { href: "/console/moments", labelKey: "moments", iconKey: "moments", visibility: "moments" },
      { href: "/console/comments", labelKey: "consoleComments", iconKey: "comments", visibility: "comments" },
      { href: "/console/guestbook", labelKey: "guestbook", iconKey: "comments", visibility: "guestbook" },
      { href: "/console/data/media", labelKey: "consoleMedia", iconKey: "media", visibility: "settings" }
    ]
  },
  {
    key: "appearance",
    labelKey: "consoleAppearance",
    iconKey: "homepage",
    basePath: "/console/settings",
    tabs: [
      { href: "/console/settings/homepage", labelKey: "consoleHomeNavigation", iconKey: "homepage", visibility: "settings" },
      { href: "/console/settings/footer", labelKey: "consoleFooter", iconKey: "footer", visibility: "settings" }
    ]
  },
  {
    key: "users",
    labelKey: "consoleUsers",
    iconKey: "users",
    basePath: "/console",
    tabs: [
      { href: "/console/users", labelKey: "consoleUserManagement", iconKey: "users", visibility: "users" },
      { href: "/console/identity", labelKey: "consoleIdentity", iconKey: "identity", visibility: "identities" },
      { href: "/console/devices", labelKey: "consoleDevices", iconKey: "devices", visibility: "users" }
    ]
  },
  {
    key: "system",
    labelKey: "consoleSystem",
    iconKey: "settings",
    basePath: "/console/settings",
    tabs: [
      { href: "/console/settings/basic", labelKey: "consoleBasicSettings", iconKey: "settings", visibility: "settings" },
      { href: "/console/settings/translation", labelKey: "consoleTranslation", iconKey: "settings", visibility: "settings" },
      { href: "/console/settings/code-injection", labelKey: "consoleCodeInjection", iconKey: "code", visibility: "codeInjection" }
    ]
  },
  {
    key: "tools",
    labelKey: "consoleTools",
    iconKey: "backup",
    basePath: "/console",
    tabs: [
      { href: "/console/mail/smtp", labelKey: "consoleSmtp", iconKey: "mail", visibility: "settings" },
      { href: "/console/mail/templates", labelKey: "consoleMailTemplates", iconKey: "templates", visibility: "mailTemplates" },
      { href: "/console/mail/logs", labelKey: "consoleMailLogs", iconKey: "logs", visibility: "mailTemplates" },
      { href: "/console/site-push", labelKey: "consoleSitePush", iconKey: "sitePush", visibility: "settings" },
      { href: "/console/data/backups", labelKey: "consoleBackup", iconKey: "backup", visibility: "backups" }
    ]
  },
  {
    key: "account",
    labelKey: "consoleAccount",
    iconKey: "account",
    basePath: "/console/account",
    tabs: [
      { href: "/console/account", labelKey: "consoleProfile", iconKey: "account", visibility: "always" }
    ]
  }
];

/** Flatten all tab hrefs for redirect matching. */
export const allConsoleHrefs = consoleSidebarGroups.flatMap((g) => g.tabs.map((t) => t.href));
