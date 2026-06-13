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

async function mockCurrentUser(page: Page): Promise<void> {
  await page.route("**/auth/me", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        user: {
          id: 1,
          username: "admin",
          email: "admin@example.com",
          role: "admin",
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
  await mockArticleList(page);

  await page.goto("/?uiDebug=1");
  await expect(page.getByRole("heading", { name: "控制台" })).toBeVisible();
  await page.waitForFunction(() => typeof window.__uiDebug?.setLanguageWipeProgress === "function");

  await page.getByRole("button", { name: "切换到英文" }).click();
  const overlay = page.locator(".admin-language-wipe__overlay");
  await expect(overlay).toBeVisible();

  const layerState = await page.evaluate(() => {
    const layers = Array.from(document.querySelectorAll<HTMLElement>(".admin-language-wipe__layer"));
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
      layerCount: layers.length,
      overlayButtonBox: buttons[1] ? toBox(buttons[1]) : null,
      overlayText: layers[1]?.innerText ?? ""
    };
  });

  expect(layerState.layerCount).toBe(2);
  expect(layerState.baseText).toContain("控制台");
  expect(layerState.overlayText).toContain("Dashboard");
  expect(layerState.baseButtonBox).not.toBeNull();
  expect(layerState.overlayButtonBox).not.toBeNull();
  expectStableBox(layerState.overlayButtonBox!, layerState.baseButtonBox!);

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
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(overlay).toHaveCount(0);
});
