import playwright from "../../apps/admin/node_modules/@playwright/test/index.js";
import type { Page, Route } from "../../apps/admin/node_modules/@playwright/test/index.js";

const { expect, test } = playwright;

const allPermissions = [
  "article:create",
  "article:update",
  "article:publish",
  "article:delete",
  "attachment:upload",
  "user:manage",
  "system:maintain"
];

const now = "2026-01-01T00:00:00.000Z";

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status
  });
}

function expectRgbaClose(actual: string | null, expected: [number, number, number, number]): void {
  expect(actual).not.toBeNull();
  const match = actual?.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/u);

  expect(match).not.toBeNull();
  if (!match) {
    return;
  }

  expect(Math.abs(Number(match[1]) - expected[0])).toBeLessThanOrEqual(2);
  expect(Math.abs(Number(match[2]) - expected[1])).toBeLessThanOrEqual(2);
  expect(Math.abs(Number(match[3]) - expected[2])).toBeLessThanOrEqual(2);
  expect(Math.abs(Number(match[4] ?? "1") - expected[3])).toBeLessThanOrEqual(0.01);
}

function dashboardResponse() {
  return {
    dashboard: {
      loginCountries: [{ label: "China", visits: 8 }, { label: "United States", visits: 2 }],
      loginDevices: [{ label: "Windows 11", visits: 7 }, { label: "macOS 15", visits: 3 }],
      popularPages: [{ path: "/zh/posts", visits: 12 }],
      range: 7,
      recentPublished: [],
      totals: {
        articles: 3,
        comments: 0,
        guestbook: 1,
        loginEvents: 10,
        loginUsers: 2,
        moments: 2,
        users: 2
      }
    }
  };
}

function adminUser(): unknown {
  return {
    createdAt: now,
    disabledAt: null,
    email: "admin@example.com",
    id: 1,
    lastLoginAt: now,
    permissions: allPermissions,
    role: "admin",
    updatedAt: now,
    username: "admin"
  };
}

async function loginAsAdmin(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("liax.admin.authToken", "admin-auth-theme-token");
    window.localStorage.setItem("liax.admin.locale", "en-US");
  });
}

test("login flow completes the TOTP challenge instead of blocking the user", async ({ page }) => {
  const loginRequests: unknown[] = [];
  const totpRequests: unknown[] = [];
  const unknownRequests: string[] = [];

  await page.addInitScript(() => {
    window.localStorage.setItem("liax.admin.locale", "en-US");
    window.localStorage.removeItem("liax.admin.authToken");
  });

  await page.route("http://127.0.0.1:3000/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path === "/auth/login" && method === "POST") {
      const input = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      loginRequests.push(input);
      await fulfillJson(route, {
        totpRequired: true,
        totpToken: "short-lived-totp-token",
        user: adminUser()
      });
      return;
    }

    if (path === "/auth/login/totp" && method === "POST") {
      const input = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      totpRequests.push(input);

      if (input.code !== "123456") {
        await fulfillJson(route, { error: { message: "Invalid verification code." } }, 401);
        return;
      }

      await fulfillJson(route, {
        token: "final-admin-token",
        user: adminUser()
      });
      return;
    }

    if (path === "/admin/me/preferences") {
      await fulfillJson(route, {
        preferences: {
          avatar_attachment_id: null,
          avatar_public_url: null,
          createdAt: now,
          locale: "en-US",
          reduced_motion: false,
          updatedAt: now,
          userId: 1
        }
      });
      return;
    }

    if (path === "/admin/dashboard") {
      await fulfillJson(route, dashboardResponse());
      return;
    }

    if (path === "/admin/settings/appearance") {
      await fulfillJson(route, {
        settings: {
          "site.logoAlt": null,
          "site.logoUrl": null,
          "theme.customColors": {},
          "theme.preset": "warm-minimal"
        }
      });
      return;
    }

    if (path === "/admin/articles") {
      await fulfillJson(route, { articles: [] });
      return;
    }

    unknownRequests.push(`${method} ${route.request().url()}`);
    await fulfillJson(route, { error: { message: `Unexpected auth request: ${path}` } }, 500);
  });

  await page.goto("/");
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("correct-password");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByText("This account uses TOTP.")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeDisabled();
  await expect(page.getByLabel("Password")).toBeDisabled();
  await expect(page.getByLabel("TOTP verification code")).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify and log in" })).toBeVisible();
  await expect(page.evaluate(() => window.localStorage.getItem("liax.admin.authToken"))).resolves.toBeNull();

  await page.getByLabel("TOTP verification code").fill("000000");
  await page.getByRole("button", { name: "Verify and log in" }).click();
  await expect(page.getByText("Invalid verification code.")).toBeVisible();
  await expect(page.locator(".admin-login-card")).toBeVisible();

  await page.getByLabel("TOTP verification code").fill("123456");
  await page.getByRole("button", { name: "Verify and log in" }).click();
  await expect(page.locator(".admin-topbar").getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.locator("main").getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.locator(".admin-dashboard-stat").first()).toBeVisible();

  const inactiveRangeButton = page.locator(".admin-dashboard-range .liax-button").nth(1);
  await inactiveRangeButton.hover();
  await page.waitForTimeout(80);
  const dashboardVisualState = await page.evaluate(() => {
    const activeRange = document.querySelector<HTMLElement>(".admin-dashboard-range .liax-button--primary");
    const hoveredRange = document.querySelectorAll<HTMLElement>(".admin-dashboard-range .liax-button")[1] ?? null;
    const statCard = document.querySelector<HTMLElement>(".admin-dashboard-stat");
    const panel = document.querySelector<HTMLElement>(".admin-dashboard-panel");
    const track = document.querySelector<HTMLElement>(".admin-dashboard-bar__track");

    return {
      activeRangeBoxShadow: activeRange ? getComputedStyle(activeRange).boxShadow : null,
      activeRangeBorderColor: activeRange ? getComputedStyle(activeRange).borderColor : null,
      hoveredRangeBoxShadow: hoveredRange ? getComputedStyle(hoveredRange).boxShadow : null,
      hoveredRangeTransform: hoveredRange ? getComputedStyle(hoveredRange).transform : null,
      panelBorderColor: panel ? getComputedStyle(panel).borderColor : null,
      panelBoxShadow: panel ? getComputedStyle(panel).boxShadow : null,
      statBorderColor: statCard ? getComputedStyle(statCard).borderColor : null,
      statBoxShadow: statCard ? getComputedStyle(statCard).boxShadow : null,
      trackBackground: track ? getComputedStyle(track).backgroundColor : null
    };
  });

  expect(dashboardVisualState.activeRangeBoxShadow).not.toBe("none");
  expect(dashboardVisualState.activeRangeBorderColor).toBe("rgb(201, 100, 66)");
  expect(dashboardVisualState.hoveredRangeBoxShadow).not.toBe("none");
  expect(dashboardVisualState.hoveredRangeTransform).not.toBe("none");
  expect(dashboardVisualState.panelBoxShadow).not.toBe("none");
  expect(dashboardVisualState.statBoxShadow).not.toBe("none");
  expectRgbaClose(dashboardVisualState.panelBorderColor, [199, 194, 185, 0.72]);
  expectRgbaClose(dashboardVisualState.statBorderColor, [199, 194, 185, 0.72]);
  expectRgbaClose(dashboardVisualState.trackBackground, [209, 207, 197, 0.44]);
  await expect(page.evaluate(() => window.localStorage.getItem("liax.admin.authToken"))).resolves.toBe("final-admin-token");

  expect(loginRequests).toEqual([{ email: "admin@example.com", password: "correct-password" }]);
  expect(totpRequests).toEqual([
    { code: "000000", totpToken: "short-lived-totp-token" },
    { code: "123456", totpToken: "short-lived-totp-token" }
  ]);
  expect(unknownRequests).toEqual([]);
});

test("theme settings keep preset cards hidden until settings finish loading", async ({ page }) => {
  const unknownRequests: string[] = [];
  const siteSettings: Record<string, unknown> = {
    "theme.customColors": {},
    "theme.preset": "warm-minimal"
  };
  let releaseSiteSettings: () => void = () => undefined;
  const siteSettingsGate = new Promise<void>((resolve) => {
    releaseSiteSettings = resolve;
  });

  await loginAsAdmin(page);
  await page.route("http://127.0.0.1:3000/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path === "/auth/me") {
      await fulfillJson(route, { user: adminUser() });
      return;
    }

    if (path === "/admin/me/preferences") {
      await fulfillJson(route, {
        preferences: {
          avatar_attachment_id: null,
          avatar_public_url: null,
          createdAt: now,
          locale: "en-US",
          reduced_motion: false,
          updatedAt: now,
          userId: 1
        }
      });
      return;
    }

    if (path === "/admin/dashboard") {
      await fulfillJson(route, dashboardResponse());
      return;
    }

    if (path === "/admin/settings/appearance") {
      await fulfillJson(route, {
        settings: {
          "site.logoAlt": null,
          "site.logoUrl": null,
          "theme.customColors": siteSettings["theme.customColors"],
          "theme.preset": siteSettings["theme.preset"]
        }
      });
      return;
    }

    if (path === "/admin/settings/site" && method === "GET") {
      await siteSettingsGate;
      await fulfillJson(route, { settings: siteSettings });
      return;
    }

    unknownRequests.push(`${method} ${route.request().url()}`);
    await fulfillJson(route, { error: { message: `Unexpected theme loading request: ${path}` } }, 500);
  });

  const navigation = page.goto("/#theme");
  await expect(page.locator("main h2").filter({ hasText: "Theme settings" })).toBeVisible();
  await expect(page.locator(".admin-theme-skeleton-card")).toHaveCount(3);
  await expect(page.locator(".admin-theme-preset-card")).toHaveCount(0);
  await expect(page.getByText("Loading settings.")).toHaveCount(0);

  releaseSiteSettings();
  await expect(page.locator(".admin-theme-skeleton-card")).toHaveCount(0);
  await expect(page.locator(".admin-theme-preset-card")).toHaveCount(3);
  await navigation;
  expect(unknownRequests).toEqual([]);
});

test("admin list pages show skeletons while initial data is loading", async ({ page }) => {
  const unknownRequests: string[] = [];
  let releaseUsers: () => void = () => undefined;
  const usersGate = new Promise<void>((resolve) => {
    releaseUsers = resolve;
  });

  await loginAsAdmin(page);
  await page.route("http://127.0.0.1:3000/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path === "/auth/me") {
      await fulfillJson(route, { user: adminUser() });
      return;
    }

    if (path === "/admin/me/preferences") {
      await fulfillJson(route, {
        preferences: {
          avatar_attachment_id: null,
          avatar_public_url: null,
          createdAt: now,
          locale: "en-US",
          reduced_motion: false,
          updatedAt: now,
          userId: 1
        }
      });
      return;
    }

    if (path === "/admin/settings/appearance") {
      await fulfillJson(route, {
        settings: {
          "site.logoAlt": null,
          "site.logoUrl": null,
          "theme.customColors": {},
          "theme.preset": "warm-minimal"
        }
      });
      return;
    }

    if (path === "/admin/dashboard") {
      await fulfillJson(route, dashboardResponse());
      return;
    }

    if (path === "/admin/roles") {
      await fulfillJson(route, {
        permissions: allPermissions,
        roles: [
          {
            builtIn: true,
            createdAt: now,
            displayName: "Admin",
            permissions: allPermissions,
            roleKey: "admin",
            updatedAt: now
          },
          {
            builtIn: true,
            createdAt: now,
            displayName: "SVIP",
            permissions: [],
            roleKey: "svip",
            updatedAt: now
          }
        ]
      });
      return;
    }

    if (path === "/admin/users") {
      await usersGate;
      await fulfillJson(route, {
        users: [
          {
            createdAt: now,
            disabledAt: null,
            email: "admin@example.com",
            id: 1,
            lastLoginAt: now,
            role: "admin",
            updatedAt: now,
            username: "admin"
          }
        ]
      });
      return;
    }

    unknownRequests.push(`${method} ${route.request().url()}`);
    await fulfillJson(route, { error: { message: `Unexpected loading skeleton request: ${path}` } }, 500);
  });

  const navigation = page.goto("/#users");
  await expect(page.locator("main h2").filter({ hasText: "User list" })).toBeVisible();
  await expect(page.locator(".admin-loading-skeleton--table")).toHaveCount(1);
  await expect(page.locator(".admin-loading-skeleton--table .admin-loading-skeleton__item")).toHaveCount(6);
  await expect(page.locator("p.admin-muted-text", { hasText: "Loading users." })).toHaveCount(0);

  releaseUsers();
  await expect(page.locator(".admin-loading-skeleton")).toHaveCount(0);
  await expect(page.getByRole("cell", { exact: true, name: "admin" })).toBeVisible();
  await navigation;
  expect(unknownRequests).toEqual([]);
});
test("theme settings keep presets simple and move customization into edit", async ({ page }) => {
  const sitePatches: unknown[] = [];
  let siteSettings: Record<string, unknown> = {
    "theme.customColors": {},
    "theme.preset": "warm-minimal"
  };

  await loginAsAdmin(page);
  await page.route("http://127.0.0.1:3000/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path === "/auth/me") {
      await fulfillJson(route, { user: adminUser() });
      return;
    }

    if (path === "/admin/me/preferences") {
      await fulfillJson(route, {
        preferences: {
          avatar_attachment_id: null,
          avatar_public_url: null,
          createdAt: now,
          locale: "en-US",
          reduced_motion: false,
          updatedAt: now,
          userId: 1
        }
      });
      return;
    }

    if (path === "/admin/dashboard") {
      await fulfillJson(route, dashboardResponse());
      return;
    }

    if (path === "/admin/settings/site") {
      if (method === "PATCH") {
        const patch = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
        sitePatches.push(patch);
        siteSettings = {
          ...siteSettings,
          ...patch
        };
      }

      await fulfillJson(route, { settings: siteSettings });
      return;
    }

    if (path === "/admin/settings/appearance") {
      await fulfillJson(route, {
        settings: {
          "site.logoAlt": siteSettings["site.logoAlt"] ?? null,
          "site.logoUrl": siteSettings["site.logoUrl"] ?? null,
          "theme.customColors": siteSettings["theme.customColors"],
          "theme.preset": siteSettings["theme.preset"]
        }
      });
      return;
    }

    throw new Error(`Unexpected theme request: ${method} ${path}`);
  });

  await page.goto("/#theme");
  await expect(page.locator("main h2").filter({ hasText: "Theme settings" })).toBeVisible();
  await expect(page.locator(".admin-theme-preset-card")).toHaveCount(3);

  for (const card of await page.locator(".admin-theme-preset-card").all()) {
    await expect(card.locator(".admin-theme-preset-card__swatches i")).toHaveCount(3);
  }

  const quietGardenCard = page.locator(".admin-theme-preset-card").filter({ hasText: "Quiet garden" });
  await quietGardenCard.getByRole("button", { name: "Use this" }).click();
  await expect(page.getByText("Theme saved.")).toBeVisible();
  await expect(quietGardenCard).toHaveAttribute("data-active", "true");
  expect(sitePatches[sitePatches.length - 1]).toEqual({
    "theme.customColors": {},
    "theme.preset": "quiet-garden"
  });

  const graphiteCard = page.locator(".admin-theme-preset-card").filter({ hasText: "Clear graphite" });
  await graphiteCard.getByRole("button", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit palette" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('input[type="color"]')).toHaveCount(5);
  await dialog.locator('input[type="color"]').first().fill("#e8eee2");
  await dialog.getByRole("button", { name: "Save custom palette" }).click();
  await expect(page.getByText("Theme saved.")).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(sitePatches[sitePatches.length - 1]).toMatchObject({
    "theme.preset": "clear-graphite"
  });
  expect((sitePatches[sitePatches.length - 1] as Record<string, Record<string, Record<string, string>>>)["theme.customColors"]["clear-graphite"]["--color-surface-muted"]).toBe("#e8eee2");
});
