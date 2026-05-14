import type { AdminNavIconKey } from "@/components/admin/admin-nav-link";

export type AdminNavVisibilityKey =
  | "always"
  | "analytics"
  | "articles"
  | "moments"
  | "comments"
  | "users"
  | "identities"
  | "settings"
  | "codeInjection"
  | "mailTemplates"
  | "backups";

/** Icon-only key that safely serializes between server/client. */
export type AdminSidebarGroupKey =
  | "dashboard"
  | "content"
  | "appearance"
  | "users"
  | "system"
  | "tools"
  | "account";

export type AdminTabItem = {
  href: string;
  labelKey: string;
  iconKey: AdminNavIconKey;
  visibility: AdminNavVisibilityKey;
};

export type AdminSidebarGroup = {
  key: AdminSidebarGroupKey;
  labelKey: string;
  iconKey: AdminNavIconKey;
  basePath: string;
  tabs: AdminTabItem[];
};

export const adminSidebarGroups: AdminSidebarGroup[] = [
  {
    key: "dashboard",
    labelKey: "adminDashboard",
    iconKey: "dashboard",
    basePath: "/admin",
    tabs: [
      {
        href: "/admin",
        labelKey: "adminConsole",
        iconKey: "dashboard",
        visibility: "analytics"
      }
    ]
  },
  {
    key: "content",
    labelKey: "adminContent",
    iconKey: "articles",
    basePath: "/admin",
    tabs: [
      { href: "/admin/articles", labelKey: "articles", iconKey: "articles", visibility: "articles" },
      { href: "/admin/tags", labelKey: "tags", iconKey: "tags", visibility: "articles" },
      { href: "/admin/moments", labelKey: "moments", iconKey: "moments", visibility: "moments" },
      { href: "/admin/comments", labelKey: "adminComments", iconKey: "comments", visibility: "comments" },
      { href: "/admin/data/media", labelKey: "adminMedia", iconKey: "media", visibility: "settings" }
    ]
  },
  {
    key: "appearance",
    labelKey: "adminAppearance",
    iconKey: "homepage",
    basePath: "/admin/settings",
    tabs: [
      { href: "/admin/settings/homepage", labelKey: "adminHomeNavigation", iconKey: "homepage", visibility: "settings" },
      { href: "/admin/settings/footer", labelKey: "adminFooter", iconKey: "footer", visibility: "settings" }
    ]
  },
  {
    key: "users",
    labelKey: "adminUsers",
    iconKey: "users",
    basePath: "/admin",
    tabs: [
      { href: "/admin/users", labelKey: "adminUserManagement", iconKey: "users", visibility: "users" },
      { href: "/admin/identity", labelKey: "adminIdentity", iconKey: "identity", visibility: "identities" },
      { href: "/admin/devices", labelKey: "adminDevices", iconKey: "devices", visibility: "users" }
    ]
  },
  {
    key: "system",
    labelKey: "adminSystem",
    iconKey: "settings",
    basePath: "/admin/settings",
    tabs: [
      { href: "/admin/settings/basic", labelKey: "adminBasicSettings", iconKey: "settings", visibility: "settings" },
      { href: "/admin/settings/translation", labelKey: "adminTranslation", iconKey: "settings", visibility: "settings" },
      { href: "/admin/settings/code-injection", labelKey: "adminCodeInjection", iconKey: "code", visibility: "codeInjection" }
    ]
  },
  {
    key: "tools",
    labelKey: "adminTools",
    iconKey: "backup",
    basePath: "/admin",
    tabs: [
      { href: "/admin/mail/smtp", labelKey: "adminSmtp", iconKey: "mail", visibility: "settings" },
      { href: "/admin/mail/templates", labelKey: "adminMailTemplates", iconKey: "templates", visibility: "mailTemplates" },
      { href: "/admin/mail/logs", labelKey: "adminMailLogs", iconKey: "logs", visibility: "mailTemplates" },
      { href: "/admin/data/backups", labelKey: "adminBackup", iconKey: "backup", visibility: "backups" }
    ]
  },
  {
    key: "account",
    labelKey: "adminAccount",
    iconKey: "account",
    basePath: "/admin/account",
    tabs: [
      { href: "/admin/account", labelKey: "adminProfile", iconKey: "account", visibility: "always" }
    ]
  }
];

/** Flatten all tab hrefs for redirect matching. */
export const allAdminHrefs = adminSidebarGroups.flatMap((g) => g.tabs.map((t) => t.href));