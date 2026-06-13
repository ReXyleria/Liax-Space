import { useEffect, useState, type ReactElement } from "react";

import type { ArticleLocale } from "./api/articleApi";
import { AttachmentPage } from "./pages/AttachmentPage";
import type { AdminPermission } from "./api/roleApi";
import { ArticleCreatePage } from "./pages/ArticleCreatePage";
import { ArticleListPage } from "./pages/ArticleListPage";
import { ArticleMarkdownEditPage } from "./pages/ArticleMarkdownEditPage";
import { ArticleTranslationEditPage } from "./pages/ArticleTranslationEditPage";
import { ArticleVersionsPage } from "./pages/ArticleVersionsPage";
import { ArchivesPage } from "./pages/ArchivesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { GuestbookPage } from "./pages/GuestbookPage";
import { LoginPage } from "./pages/LoginPage";
import { MomentsPage } from "./pages/MomentsPage";
import { PermissionsPage } from "./pages/PermissionsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { TagsPage } from "./pages/TagsPage";
import { ThemePage } from "./pages/ThemePage";
import { UserManagementPage } from "./pages/UserManagementPage";
import { hasAnyPermission } from "./auth/permissions";
import { authStore, type AuthState } from "./stores/authStore";

function readHash(): string {
  return typeof window === "undefined" ? "" : window.location.hash;
}

function readEditArticleId(hash: string): number | null {
  const match = /^#articles\/(\d+)\/edit$/.exec(hash);

  if (!match) {
    return null;
  }

  const articleId = Number(match[1]);
  return Number.isInteger(articleId) && articleId > 0 ? articleId : null;
}

function readContentRoute(hash: string): { articleId: number; locale: ArticleLocale } | null {
  const match = /^#articles\/(\d+)\/(zh-CN|en-US)\/(?:content|markdown)$/.exec(hash);

  if (!match) {
    return null;
  }

  const articleId = Number(match[1]);

  if (!Number.isInteger(articleId) || articleId <= 0) {
    return null;
  }

  return {
    articleId,
    locale: match[2] as ArticleLocale
  };
}

function readVersionsRoute(hash: string): { articleId: number; locale: ArticleLocale } | null {
  const match = /^#articles\/(\d+)\/(zh-CN|en-US)\/versions$/.exec(hash);

  if (!match) {
    return null;
  }

  const articleId = Number(match[1]);

  if (!Number.isInteger(articleId) || articleId <= 0) {
    return null;
  }

  return {
    articleId,
    locale: match[2] as ArticleLocale
  };
}

function canAccessRoute(user: AuthState["user"], requiredPermissions: readonly AdminPermission[]): boolean {
  return hasAnyPermission(user, requiredPermissions);
}

export function App(): ReactElement {
  const [hash, setHash] = useState(() => readHash());
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getSnapshot());

  useEffect(() => authStore.subscribe(setAuthState), []);

  useEffect(() => {
    if (authState.status !== "authenticated" || authState.user) {
      return;
    }

    void authStore.loadCurrentUser().catch(() => {
      authStore.logout();
    });
  }, [authState.status, authState.user]);

  useEffect(() => {
    function handleHashChange(): void {
      setHash(readHash());
      window.scrollTo(0, 0);
    }

    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  if (authState.status !== "authenticated") {
    return <LoginPage />;
  }

  if (hash === "" || hash === "#dashboard") {
    return <DashboardPage />;
  }

  if (hash === "#articles/new") {
    if (!canAccessRoute(authState.user, ["article:create"])) {
      return <DashboardPage />;
    }

    return <ArticleCreatePage />;
  }

  if (hash === "#attachments") {
    if (!canAccessRoute(authState.user, ["attachment:upload"])) {
      return <DashboardPage />;
    }

    return <AttachmentPage />;
  }

  if (hash === "#settings") {
    if (!canAccessRoute(authState.user, ["system:maintain"])) {
      return <DashboardPage />;
    }

    return <SettingsPage />;
  }

  if (hash === "#profile") {
    return <ProfilePage />;
  }

  if (hash === "#users") {
    if (!canAccessRoute(authState.user, ["user:manage"])) {
      return <DashboardPage />;
    }

    return <UserManagementPage />;
  }

  if (hash === "#tags") {
    if (!canAccessRoute(authState.user, ["article:update"])) {
      return <DashboardPage />;
    }

    return <TagsPage />;
  }

  if (hash === "#moments") {
    if (!canAccessRoute(authState.user, ["article:update"])) {
      return <DashboardPage />;
    }

    return <MomentsPage />;
  }

  if (hash === "#guestbook") {
    if (!canAccessRoute(authState.user, ["article:update"])) {
      return <DashboardPage />;
    }

    return <GuestbookPage />;
  }

  if (hash === "#archives") {
    return <ArchivesPage />;
  }

  if (hash === "#permissions") {
    if (!canAccessRoute(authState.user, ["system:maintain"])) {
      return <DashboardPage />;
    }

    return <PermissionsPage />;
  }

  if (hash === "#theme") {
    if (!canAccessRoute(authState.user, ["system:maintain"])) {
      return <DashboardPage />;
    }

    return <ThemePage />;
  }

  const versionsRoute = readVersionsRoute(hash);

  if (versionsRoute) {
    if (!canAccessRoute(authState.user, ["article:publish"])) {
      return <DashboardPage />;
    }

    return <ArticleVersionsPage articleId={versionsRoute.articleId} locale={versionsRoute.locale} />;
  }

  const contentRoute = readContentRoute(hash);

  if (contentRoute) {
    if (!canAccessRoute(authState.user, ["article:update"])) {
      return <DashboardPage />;
    }

    return <ArticleMarkdownEditPage articleId={contentRoute.articleId} locale={contentRoute.locale} />;
  }

  const editArticleId = readEditArticleId(hash);

  if (editArticleId !== null) {
    if (!canAccessRoute(authState.user, ["article:update"])) {
      return <DashboardPage />;
    }

    return <ArticleTranslationEditPage articleId={editArticleId} />;
  }

  return <ArticleListPage />;
}
