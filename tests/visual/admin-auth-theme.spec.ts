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
  await expect(page.locator("main").getByRole("heading", { name: "Content workspace" })).toBeVisible();
  await expect(page.evaluate(() => window.localStorage.getItem("liax.admin.authToken"))).resolves.toBe("final-admin-token");

  expect(loginRequests).toEqual([{ email: "admin@example.com", password: "correct-password" }]);
  expect(totpRequests).toEqual([
    { code: "000000", totpToken: "short-lived-totp-token" },
    { code: "123456", totpToken: "short-lived-totp-token" }
  ]);
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
