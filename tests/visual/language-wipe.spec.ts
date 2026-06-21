import playwright from "../../apps/admin/node_modules/@playwright/test/index.js";
import type { Page } from "../../apps/admin/node_modules/@playwright/test/index.js";

const { expect, test } = playwright;

declare global {
  interface Window {
    __uiDebug?: {
      setLanguageWipeProgress: (progress: number) => void;
    };
  }
}

const frames = [
  { filename: "frame-000.png", progress: 0 },
  { filename: "frame-025.png", progress: 0.25 },
  { filename: "frame-050.png", progress: 0.5 },
  { filename: "frame-075.png", progress: 0.75 },
  { filename: "frame-100.png", progress: 1 }
];

type Box = {
  height: number;
  left: number;
  top: number;
  width: number;
};

function expectStableBox(actual: Box, expected: Box): void {
  expect(Math.abs(actual.left - expected.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(actual.top - expected.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(actual.width - expected.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(actual.height - expected.height)).toBeLessThanOrEqual(1);
}

async function mockArticleList(page: Page): Promise<void> {
  await page.route("**/admin/articles**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ articles: [] }),
      contentType: "application/json",
      status: 200
    });
  });
}

async function mockAppearance(page: Page): Promise<void> {
  await page.route("**/admin/settings/appearance", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        settings: {
          "site.logoAlt": null,
          "site.logoUrl": null,
          "theme.customColors": {},
          "theme.preset": "warm-minimal"
        }
      }),
      contentType: "application/json",
      status: 200
    });
  });
}

async function mockDashboard(page: Page): Promise<() => number> {
  let dashboardRequests = 0;
  await page.route("**/admin/dashboard**", async (route) => {
    dashboardRequests += 1;
    if (dashboardRequests > 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    await route.fulfill({
      body: JSON.stringify({
        dashboard: {
          loginCountries: [{ label: "China", visits: 8 }],
          loginDevices: [{ label: "Windows 11", visits: 7 }],
          popularPages: [],
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
      }),
      contentType: "application/json",
      status: 200
    });
  });

  return () => dashboardRequests;
}

async function mockCurrentUser(page: Page): Promise<void> {
  await page.route("**/auth/me", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        user: {
          id: 1,
          username: "admin",
          email: "admin@example.com",
          role: "admin",
          permissions: ["article:create", "article:update", "article:publish", "article:delete", "attachment:upload", "user:manage", "system:maintain"],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          lastLoginAt: null,
          disabledAt: null
        }
      }),
      contentType: "application/json",
      status: 200
    });
  });
}

test("does not expose language wipe debug API outside debug mode", async ({ page }) => {
  await mockArticleList(page);
  await page.goto("/");

  const hasDebugApi = await page.evaluate(() => window.__uiDebug !== undefined);

  expect(hasDebugApi).toBe(false);
});

test("captures controlled language wipe frames", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("liax.admin.authToken", "visual-test-token");
    window.localStorage.setItem("liax.admin.locale", "zh-CN");
  });
  await mockCurrentUser(page);
  await mockAppearance(page);
  const readDashboardRequests = await mockDashboard(page);
  await mockArticleList(page);

  await page.goto("/?uiDebug=1");
  await expect(page.getByRole("heading", { level: 1, name: "控制台" })).toBeVisible();
  await expect(page.getByText("China")).toBeVisible();
  await expect(page.getByText("Windows 11")).toBeVisible();
  await page.waitForFunction(() => typeof window.__uiDebug?.setLanguageWipeProgress === "function");
  const dashboardRequestsBeforeSwitch = readDashboardRequests();
  expect(dashboardRequestsBeforeSwitch).toBeGreaterThan(0);

  const beforeSwitchBox = await page.evaluate(() => {
    const button = document.querySelector<HTMLElement>(".admin-language-switch")!;
    const rect = button.getBoundingClientRect();

    return {
      height: rect.height,
      left: rect.left,
      top: rect.top,
      width: rect.width
    };
  });

  await page.getByRole("button", { name: "切换到英文" }).click();
  const overlay = page.locator(".admin-language-wipe__overlay");
  await expect(overlay).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

  const layerState = await page.evaluate(() => {
    const layers = Array.from(document.querySelectorAll<HTMLElement>(".admin-language-wipe__layer"));
    const overlayRoot = document.querySelector<HTMLElement>(".admin-language-wipe__overlay");
    const buttons = Array.from(document.querySelectorAll<HTMLElement>(".admin-language-switch"));
    const toBox = (element: HTMLElement): Box => {
      const rect = element.getBoundingClientRect();

      return {
        height: rect.height,
        left: rect.left,
        top: rect.top,
        width: rect.width
      };
    };

    return {
      baseButtonBox: buttons[0] ? toBox(buttons[0]) : null,
      baseText: layers[0]?.innerText ?? "",
      buttonCount: buttons.length,
      layerCount: layers.length,
      overlayText: overlayRoot?.innerText ?? ""
    };
  });

  expect(layerState.layerCount).toBe(1);
  expect(layerState.buttonCount).toBe(1);
  expect(layerState.baseText).toContain("Dashboard");
  expect(layerState.baseText).not.toContain("正在加载控制台数据。");
  expect(layerState.baseText).not.toContain("Loading dashboard data.");
  expect(layerState.overlayText).toBe("");
  expect(layerState.baseButtonBox).not.toBeNull();
  expectStableBox(layerState.baseButtonBox!, beforeSwitchBox);
  expect(readDashboardRequests()).toBe(dashboardRequestsBeforeSwitch);

  for (const frame of frames) {
    await page.evaluate((progress) => {
      window.__uiDebug?.setLanguageWipeProgress(progress);
    }, frame.progress);

    if (frame.progress < 1) {
      await expect(overlay).toHaveAttribute("data-wipe-progress", frame.progress.toFixed(2));
    } else {
      await expect(overlay).toHaveCount(0);
    }

    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath(frame.filename)
    });
  }

  const finalLocale = await page.evaluate(() => window.localStorage.getItem("liax.admin.locale"));

  expect(finalLocale).toBe("en-US");
  expect(readDashboardRequests()).toBe(dashboardRequestsBeforeSwitch);
  await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  await expect(overlay).toHaveCount(0);
});
