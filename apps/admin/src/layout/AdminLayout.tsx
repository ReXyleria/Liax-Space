import { useEffect, useState, type ReactElement, type ReactNode } from "react";

import type { AdminPermission } from "../api/roleApi";
import { hasAnyPermission } from "../auth/permissions";
import { settingsApi } from "../api/settingsApi";
import { LanguageSwitchButton } from "../effects/language-wipe/LanguageSwitchButton";
import { useT } from "../i18n/useT";
import { authStore, type AuthState } from "../stores/authStore";

export type AdminLayoutProps = {
  avatarUrl?: string | null;
  children: ReactNode;
};

type NavItem = {
  href: string;
  key: string;
  match: (hash: string) => boolean;
  requiredPermissions?: AdminPermission[];
};

function currentHash(): string {
  if (typeof window === "undefined") {
    return "#dashboard";
  }

  return window.location.hash || "#dashboard";
}

export function AdminLayout({ avatarUrl = null, children }: AdminLayoutProps): ReactElement {
  const t = useT();
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getSnapshot());
  const [loadedAvatarUrl, setLoadedAvatarUrl] = useState<string | null>(null);
  const [activeHash, setActiveHash] = useState(currentHash);
  const visibleAvatarUrl = avatarUrl ?? loadedAvatarUrl;
  const navGroups: Array<{ key: string; items: NavItem[] }> = [
    {
      key: "nav.group.content",
      items: [
        { href: "#dashboard", key: "nav.dashboard", match: (hash) => hash === "" || hash === "#dashboard" },
        { href: "#articles", key: "nav.articles", match: (hash) => hash === "#articles" || hash.startsWith("#articles/") },
        {
          href: "#attachments",
          key: "nav.attachments",
          match: (hash) => hash.startsWith("#attachments"),
          requiredPermissions: ["attachment:upload"]
        },
        { href: "#tags", key: "nav.tags", match: (hash) => hash.startsWith("#tags"), requiredPermissions: ["article:update"] },
        { href: "#moments", key: "nav.moments", match: (hash) => hash.startsWith("#moments"), requiredPermissions: ["article:update"] },
        { href: "#guestbook", key: "nav.guestbook", match: (hash) => hash.startsWith("#guestbook"), requiredPermissions: ["article:update"] },
        { href: "#archives", key: "nav.archives", match: (hash) => hash.startsWith("#archives") }
      ]
    },
    {
      key: "nav.group.users",
      items: [
        { href: "#users", key: "nav.users", match: (hash) => hash.startsWith("#users"), requiredPermissions: ["user:manage"] },
        {
          href: "#permissions",
          key: "nav.permissions",
          match: (hash) => hash.startsWith("#permissions"),
          requiredPermissions: ["system:maintain"]
        }
      ]
    },
    {
      key: "nav.group.system",
      items: [
        { href: "#profile", key: "nav.profile", match: (hash) => hash.startsWith("#profile") },
        { href: "#settings", key: "nav.settings", match: (hash) => hash.startsWith("#settings"), requiredPermissions: ["system:maintain"] },
        { href: "#theme", key: "nav.theme", match: (hash) => hash.startsWith("#theme"), requiredPermissions: ["system:maintain"] }
      ]
    }
  ];
  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasAnyPermission(authState.user, item.requiredPermissions ?? []))
    }))
    .filter((group) => group.items.length > 0);
  const activeItem = visibleNavGroups.flatMap((group) => group.items).find((item) => item.match(activeHash)) ?? visibleNavGroups[0].items[0];

  useEffect(() => authStore.subscribe(setAuthState), []);

  useEffect(() => {
    if (avatarUrl !== null) {
      return;
    }

    let isMounted = true;

    settingsApi.getUserPreferences()
      .then((response) => {
        if (isMounted) {
          setLoadedAvatarUrl(response.preferences.avatar_public_url);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoadedAvatarUrl(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [avatarUrl]);

  useEffect(() => {
    function handleHashChange(): void {
      setActiveHash(currentHash());
    }

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar" aria-label={t("nav.main")}>
        <div className="admin-sidebar__brand" aria-label="Liax Space">
          <span className="admin-sidebar__logo" aria-hidden="true">LS</span>
          <span>Liax Space</span>
        </div>
        <nav className="admin-nav" aria-label={t("nav.main")}>
          {visibleNavGroups.map((group) => (
            <section className="admin-nav__group" aria-label={t(group.key)} key={group.key}>
              <p>{t(group.key)}</p>
              {group.items.map((item) => (
                <a
                  aria-current={item.match(activeHash) ? "page" : undefined}
                  className={item.match(activeHash) ? "admin-nav__link admin-nav__link--active" : "admin-nav__link"}
                  href={item.href}
                  key={item.href}
                >
                  {t(item.key)}
                </a>
              ))}
            </section>
          ))}
        </nav>
      </aside>

      <div className="admin-layout__main">
        <header className="admin-topbar">
          <div className="admin-topbar__title">
            <p className="admin-kicker">{t("dashboard.kicker")}</p>
            <h1>{t(activeItem.key)}</h1>
          </div>
          <div className="admin-topbar__actions">
            <LanguageSwitchButton />
            <a className="admin-topbar__avatar" href="#profile" aria-label={t("settings.personal")}>
              {visibleAvatarUrl ? <img alt="" src={visibleAvatarUrl} /> : "A"}
            </a>
          </div>
        </header>

        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
