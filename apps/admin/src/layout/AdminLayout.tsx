import { useEffect, useState, type ReactElement, type ReactNode } from "react";

import type { AdminPermission } from "../api/roleApi";
import { hasAnyPermission } from "../auth/permissions";
import { settingsApi } from "../api/settingsApi";
import { LanguageSwitchButton } from "../effects/language-wipe/LanguageSwitchButton";
import { useVerifiedImageUrl } from "../hooks/useVerifiedImageUrl";
import { readStoredLocale } from "../i18n/localeStorage";
import { useT } from "../i18n/useT";
import { authStore, type AuthState } from "../stores/authStore";
import { siteAppearanceUpdatedEventName } from "../theme/siteTheme";

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

function readLogoSettings(settings: Record<string, unknown>): { logoAlt: string; logoUrl: string | null } {
  const logoUrl = settings["site.logoUrl"];
  const logoAlt = settings["site.logoAlt"];

  return {
    logoAlt: typeof logoAlt === "string" && logoAlt.trim() ? logoAlt.trim() : "Liax Space",
    logoUrl: typeof logoUrl === "string" && logoUrl.trim() ? logoUrl.trim() : null
  };
}

function readPublicHomeHref(): string {
  return readStoredLocale() === "en-US" ? "/en" : "/zh";
}

export function AdminLayout({ avatarUrl = null, children }: AdminLayoutProps): ReactElement {
  const t = useT();
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getSnapshot());
  const [loadedAvatarUrl, setLoadedAvatarUrl] = useState<string | null>(null);
  const [siteLogoAlt, setSiteLogoAlt] = useState("Liax Space");
  const [siteLogoUrl, setSiteLogoUrl] = useState<string | null>(null);
  const [activeHash, setActiveHash] = useState(currentHash);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const publicHomeHref = readPublicHomeHref();
  const avatarImage = useVerifiedImageUrl(avatarUrl ?? loadedAvatarUrl);
  const logoImage = useVerifiedImageUrl(siteLogoUrl);
  const visibleAvatarUrl = avatarImage.url;
  const visibleLogoUrl = logoImage.url;
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
    if (authState.status !== "authenticated") {
      return;
    }

    let isMounted = true;

    settingsApi.getAppearanceSettings()
      .then((response) => {
        if (!isMounted) {
          return;
        }

        const logoSettings = readLogoSettings(response.settings);
        setSiteLogoUrl(logoSettings.logoUrl);
        setSiteLogoAlt(logoSettings.logoAlt);
      })
      .catch(() => {
        if (isMounted) {
          setSiteLogoUrl(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authState.status]);

  useEffect(() => {
    function handleAppearanceUpdated(event: Event): void {
      if (!(event instanceof CustomEvent)) {
        return;
      }

      const logoSettings = readLogoSettings(event.detail as Record<string, unknown>);
      setSiteLogoUrl(logoSettings.logoUrl);
      setSiteLogoAlt(logoSettings.logoAlt);
    }

    window.addEventListener(siteAppearanceUpdatedEventName, handleAppearanceUpdated);

    return () => {
      window.removeEventListener(siteAppearanceUpdatedEventName, handleAppearanceUpdated);
    };
  }, []);

  useEffect(() => {
    function handleHashChange(): void {
      setActiveHash(currentHash());
      setIsMobileNavOpen(false);
    }

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar" aria-label={t("nav.main")} data-open={isMobileNavOpen ? "true" : "false"} id="admin-sidebar">
        <a className="admin-sidebar__brand" href={publicHomeHref} aria-label="Liax Space">
          <span className="admin-sidebar__logo" aria-hidden={visibleLogoUrl ? undefined : "true"}>
            {visibleLogoUrl ? <img alt={siteLogoAlt} onError={() => {
              logoImage.markFailed();
            }} src={visibleLogoUrl} /> : <span aria-hidden="true">LS</span>}
          </span>
          <span>Liax Space</span>
        </a>
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
                  onClick={() => setIsMobileNavOpen(false)}
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
            <button
              aria-controls="admin-sidebar"
              aria-expanded={isMobileNavOpen}
              aria-label={isMobileNavOpen ? t("nav.closeMain") : t("nav.openMain")}
              className="admin-mobile-nav-toggle"
              onClick={() => setIsMobileNavOpen((isOpen) => !isOpen)}
              type="button"
            >
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
            </button>
            <LanguageSwitchButton />
            <a className="admin-topbar__avatar" href={publicHomeHref} aria-label="Liax Space">
              {visibleAvatarUrl ? <img alt="" onError={() => {
                avatarImage.markFailed();
              }} src={visibleAvatarUrl} /> : <span aria-hidden="true">A</span>}
            </a>
          </div>
        </header>

        <div className="admin-mobile-strategy" role="note">
          {t("layout.mobileStrategy")}
        </div>

        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
