import playwright from "../../apps/admin/node_modules/@playwright/test/index.js";
import type { Page, Route } from "../../apps/admin/node_modules/@playwright/test/index.js";

const { expect, test } = playwright;

const publicBaseUrl = "http://127.0.0.1:3817";

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

type Box = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type ShellMetrics = {
  avatar: Box;
  contentAnimationDuration: string;
  contentAnimationName: string;
  languageButton: Box;
  sidebar: Box;
  topbar: Box;
};

type AdminFlowMockState = {
  avatarUploads: number;
  preferencePatches: unknown[];
  sitePatches: unknown[];
  unknownRequests: string[];
};

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status
  });
}

async function installAdminFlowMocks(page: Page, state: AdminFlowMockState): Promise<void> {
  let siteSettings: Record<string, unknown> = {
    "ai.apiKeyConfigured": true,
    "ai.baseUrl": "https://api.deepseek.com",
    "ai.model": "deepseek-chat",
    "ai.provider": "deepseek",
    "ai.translationTemperature": 0.7,
    "home.brandInfo": "Liax Space",
    "home.contactItems.en-US": "Email:hello@example.com",
    "home.contactItems.zh-CN": "邮箱:hello@example.com",
    "home.icpNumber": "ICP备案号",
    "home.icpUrl": "https://beian.miit.gov.cn",
    "home.signature": "Timeless Silent Vigil",
    "theme.customColors": {},
    "theme.preset": "warm-minimal"
  };
  let preferences = {
    avatar_attachment_id: null as number | null,
    avatar_public_url: null as string | null,
    createdAt: now,
    locale: "en-US",
    reduced_motion: false,
    updatedAt: now,
    userId: 1
  };

  await page.route("http://127.0.0.1:3000/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path === "/auth/me") {
      await fulfillJson(route, {
        user: {
          createdAt: now,
          disabledAt: null,
          email: "admin@example.com",
          id: 1,
          lastLoginAt: null,
          permissions: allPermissions,
          role: "admin",
          updatedAt: now,
          username: "admin"
        }
      });
      return;
    }

    if (path === "/admin/me/preferences") {
      if (method === "PATCH") {
        const patch = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
        state.preferencePatches.push(patch);
        preferences = {
          ...preferences,
          avatar_attachment_id:
            patch.avatar_attachment_id === null || typeof patch.avatar_attachment_id === "number"
              ? patch.avatar_attachment_id
              : preferences.avatar_attachment_id,
          avatar_public_url: patch.avatar_attachment_id === null ? null : preferences.avatar_public_url,
          locale: patch.locale === "zh-CN" || patch.locale === "en-US" ? patch.locale : preferences.locale,
          reduced_motion: typeof patch.reduced_motion === "boolean" ? patch.reduced_motion : preferences.reduced_motion,
          updatedAt: now
        };
      }

      await fulfillJson(route, { preferences });
      return;
    }

    if (path === "/admin/settings/site") {
      if (method === "PATCH") {
        const patch = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
        state.sitePatches.push(patch);
        siteSettings = {
          ...siteSettings,
          ...patch,
          "ai.apiKeyConfigured": patch["ai.apiKey"] ? true : siteSettings["ai.apiKeyConfigured"]
        };
        delete siteSettings["ai.apiKey"];
      }

      await fulfillJson(route, { settings: siteSettings });
      return;
    }

    if (path === "/admin/me/avatar" && method === "POST") {
      state.avatarUploads += 1;
      preferences = {
        ...preferences,
        avatar_attachment_id: 77,
        avatar_public_url: "/uploads/2026/01/01/avatar.png",
        updatedAt: now
      };
      await fulfillJson(route, {
        attachment: {
          createdAt: now,
          deletedAt: null,
          id: 77,
          mimeType: "image/png",
          originalFilename: "avatar.png",
          ownerId: 1,
          publicUrl: "/uploads/2026/01/01/avatar.png",
          sha256: "a".repeat(64),
          sizeBytes: 8,
          storageKey: "uploads/2026/01/01/avatar.png"
        },
        markdown: "attachment://77",
        preferences
      });
      return;
    }

    if (path === "/auth/passkeys") {
      await fulfillJson(route, { passkeys: [] });
      return;
    }

    if (path === "/admin/articles") {
      await fulfillJson(route, { articles: [] });
      return;
    }

    state.unknownRequests.push(route.request().url());
    await fulfillJson(route, { error: { message: `Unexpected request: ${path}` } }, 500);
  });
}

function createAdminFlowMockState(): AdminFlowMockState {
  return {
    avatarUploads: 0,
    preferencePatches: [],
    sitePatches: [],
    unknownRequests: []
  };
}

async function loginAsAdmin(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("liax.admin.authToken", "admin-transition-test-token");
    window.localStorage.setItem("liax.admin.locale", "en-US");
  });
}

async function collectShellMetrics(page: Page): Promise<ShellMetrics> {
  return page.evaluate(() => {
    const toBox = (selector: string): Box => {
      const element = document.querySelector<HTMLElement>(selector);

      if (!element) {
        throw new Error(`${selector} was not found.`);
      }

      const rect = element.getBoundingClientRect();

      return {
        height: rect.height,
        left: rect.left,
        top: rect.top,
        width: rect.width
      };
    };
    const contentStyle = window.getComputedStyle(document.querySelector<HTMLElement>(".admin-content")!);

    return {
      avatar: toBox(".admin-topbar__avatar"),
      contentAnimationDuration: contentStyle.animationDuration,
      contentAnimationName: contentStyle.animationName,
      languageButton: toBox(".admin-language-switch"),
      sidebar: toBox(".admin-sidebar"),
      topbar: toBox(".admin-topbar")
    };
  });
}

function expectStableBox(actual: Box, expected: Box, tolerance = 1): void {
  expect(Math.abs(actual.left - expected.left)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.top - expected.top)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.width - expected.width)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.height - expected.height)).toBeLessThanOrEqual(tolerance);
}

function expectStableShell(actual: ShellMetrics, expected: ShellMetrics): void {
  expectStableBox(actual.sidebar, expected.sidebar);
  expectStableBox(actual.topbar, expected.topbar);
  expectStableBox(actual.languageButton, expected.languageButton);
  expectStableBox(actual.avatar, expected.avatar);
  expect(actual.contentAnimationName).toBe("admin-page-enter");
  expect(actual.contentAnimationDuration).toBe("0.36s");
}

test("admin page transitions keep the shell stable and content animation bounded", async ({ page }) => {
  const mockState = createAdminFlowMockState();

  await loginAsAdmin(page);
  await installAdminFlowMocks(page, mockState);

  await page.goto("/#articles");
  await expect(page.getByRole("heading", { name: "Article list" })).toBeVisible();
  const articleMetrics = await collectShellMetrics(page);

  await page.locator('a[href="#settings"]').click();
  await expect(page.locator("main").getByRole("heading", { name: "Site settings" }).first()).toBeVisible();
  expectStableShell(await collectShellMetrics(page), articleMetrics);

  await page.locator('.admin-nav a[href="#profile"]').click();
  await expect(page.locator("main").getByRole("heading", { name: "Personal settings" }).first()).toBeVisible();
  expectStableShell(await collectShellMetrics(page), articleMetrics);

  await page.locator('a[href="#theme"]').click();
  await expect(page.locator("main").getByRole("heading", { name: "Theme settings" }).first()).toBeVisible();
  expectStableShell(await collectShellMetrics(page), articleMetrics);

  expect(mockState.unknownRequests).toEqual([]);
});

test("admin settings keep AI provider presets and validation predictable", async ({ page }) => {
  const mockState = createAdminFlowMockState();

  await loginAsAdmin(page);
  await installAdminFlowMocks(page, mockState);

  await page.goto("/#settings");
  await expect(page.locator("main").getByRole("heading", { name: "Site settings" }).first()).toBeVisible();

  await page.getByLabel("Translation provider").selectOption("openai");
  await expect(page.getByLabel("API base URL")).toHaveValue("https://api.openai.com/v1");
  await expect(page.getByLabel("Model name")).toHaveValue("gpt-4.1-mini");

  await page.getByLabel("Translation provider").selectOption("ollama");
  await expect(page.getByLabel("API base URL")).toHaveValue("http://localhost:11434/v1");
  await expect(page.getByLabel("Model name")).toHaveValue("llama3.1");

  await page.getByLabel("Temperature").fill("2.5");
  await page.getByRole("button", { name: "Save AI settings" }).click();
  await expect(page.getByText("Temperature must be a number from 0 to 2.")).toBeVisible();
  expect(mockState.sitePatches).toEqual([]);

  await page.getByLabel("Temperature").fill("0.3");
  await page.getByRole("button", { name: "Save AI settings" }).click();
  await expect(page.getByText("AI settings saved.")).toBeVisible();

  expect(mockState.sitePatches[mockState.sitePatches.length - 1]).toEqual({
    "ai.baseUrl": "http://localhost:11434/v1",
    "ai.model": "llama3.1",
    "ai.provider": "ollama",
    "ai.translationTemperature": 0.3
  });
  expect(mockState.unknownRequests).toEqual([]);
});

test("admin settings save public home content as deliberate site settings", async ({ page }) => {
  const mockState = createAdminFlowMockState();

  await loginAsAdmin(page);
  await installAdminFlowMocks(page, mockState);

  await page.goto("/#settings");
  await expect(page.locator("main").getByRole("heading", { name: "Site settings" }).first()).toBeVisible();

  const homeCard = page.locator(".liax-card").filter({ hasText: "Home information" });
  await homeCard.getByLabel("Signature").fill("Quiet Orbit");
  await homeCard.getByLabel("Bottom-left brand text").fill("Liax Space · Clean personal publishing");
  await homeCard.getByLabel("Bottom-right ICP text").fill("蜀ICP备20260606号-1");
  await homeCard.getByLabel("ICP platform link").fill("https://beian.miit.gov.cn");
  await homeCard.getByLabel("Chinese contact methods").fill("邮箱:quiet@example.com\n主页:https://liax.example");
  await homeCard.getByLabel("English contact methods").fill("Email:quiet@example.com\nWebsite:https://liax.example");
  await homeCard.getByRole("button", { name: "Save settings" }).click();

  await expect(page.getByText("Home information saved.")).toBeVisible();
  expect(mockState.sitePatches[mockState.sitePatches.length - 1]).toEqual({
    "home.brandInfo": "Liax Space · Clean personal publishing",
    "home.contactItems.en-US": "Email:quiet@example.com\nWebsite:https://liax.example",
    "home.contactItems.zh-CN": "邮箱:quiet@example.com\n主页:https://liax.example",
    "home.icpNumber": "蜀ICP备20260606号-1",
    "home.icpUrl": "https://beian.miit.gov.cn",
    "home.signature": "Quiet Orbit"
  });
  expect(mockState.unknownRequests).toEqual([]);
});

test("profile avatar flow rejects unsafe files before upload and updates the shell on success", async ({ page }) => {
  const mockState = createAdminFlowMockState();

  await loginAsAdmin(page);
  await installAdminFlowMocks(page, mockState);

  await page.goto("/#profile");
  await expect(page.locator("main").getByRole("heading", { name: "Personal settings" }).first()).toBeVisible();

  await page.locator(".admin-avatar-file-input").setInputFiles({
    buffer: Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"),
    mimeType: "image/svg+xml",
    name: "avatar.svg"
  });
  await expect(page.getByText("Avatar must be a JPEG, PNG, WebP, or GIF image.")).toBeVisible();
  expect(mockState.avatarUploads).toBe(0);

  await page.locator(".admin-avatar-file-input").setInputFiles({
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    mimeType: "image/png",
    name: "avatar.png"
  });
  await expect(page.getByText("Avatar updated.")).toBeVisible();
  await expect(page.locator(".admin-topbar__avatar img")).toHaveAttribute("src", "/uploads/2026/01/01/avatar.png");
  expect(mockState.avatarUploads).toBe(1);

  await page.getByRole("button", { name: "Remove avatar" }).click();
  await expect(page.getByText("Avatar removed.")).toBeVisible();
  await expect(page.locator(".admin-topbar__avatar img")).toHaveCount(0);
  expect(mockState.preferencePatches[mockState.preferencePatches.length - 1]).toEqual({ avatar_attachment_id: null });
  expect(mockState.unknownRequests).toEqual([]);
});

test("public language switch uses a real old-to-new overlay without moving header controls", async ({ page }) => {
  await page.goto(`${publicBaseUrl}/zh`);
  await expect(page.locator(".liax-public-header")).toBeVisible();
  await page.waitForTimeout(450);

  const before = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(".liax-public-header")!;
    const languageButton = document.querySelector<HTMLElement>("[data-locale-target='en-US']")!;
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
      header: toBox(header),
      languageButton: toBox(languageButton),
      mainText: document.querySelector<HTMLElement>("main")?.innerText ?? ""
    };
  });

  await page.locator("[data-locale-target='en-US']").click();
  const overlay = page.locator("[data-language-wipe-overlay='true']");
  await expect(overlay).toBeVisible();

  const during = await page.evaluate(() => {
    const overlayRoot = document.querySelector<HTMLElement>("[data-language-wipe-overlay='true']")!;
    const overlayHeader = overlayRoot.querySelector<HTMLElement>(".liax-public-header")!;
    const overlayButton = overlayRoot.querySelector<HTMLElement>("[data-locale-target='zh-CN']")!;
    const overlayMain = overlayRoot.querySelector<HTMLElement>("main")!;
    const overlayStyle = window.getComputedStyle(overlayRoot);
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
      currentLang: document.documentElement.lang,
      currentMainText: document.querySelector<HTMLElement>("main")?.innerText ?? "",
      overlayButton: toBox(overlayButton),
      overlayClipPath: overlayStyle.clipPath,
      overlayHeader: toBox(overlayHeader),
      overlayMainText: overlayMain.innerText,
      overlayTransitionDuration: overlayStyle.transitionDuration
    };
  });

  expect(before.mainText).toContain("作者");
  expect(during.currentLang).toBe("zh-CN");
  expect(during.currentMainText).toContain("作者");
  expect(during.overlayMainText).toContain("Author");
  expect(during.overlayClipPath).toContain("circle");
  expect(during.overlayTransitionDuration).toContain("0.9s");
  expectStableBox(during.overlayHeader, before.header);
  expectStableBox(during.overlayButton, before.languageButton);

  await page.waitForURL(`${publicBaseUrl}/en`);
  await expect(overlay).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");

  const finalLocaleState = await page.evaluate(() => ({
    adminLocale: window.localStorage.getItem("liax.admin.locale"),
    publicLocale: window.localStorage.getItem("liax.public.locale")
  }));

  expect(finalLocaleState).toEqual({
    adminLocale: "en-US",
    publicLocale: "en-US"
  });
});

test("public search opens as a focused overlay, closes cleanly, and keeps the current locale", async ({ page }) => {
  await page.goto(`${publicBaseUrl}/zh`);
  await expect(page.locator(".liax-public-header")).toBeVisible();
  await page.waitForTimeout(450);

  await page.locator(".liax-public-search").click();
  const overlay = page.locator("[data-public-search-overlay='true']");
  await expect(overlay).toBeVisible();
  await expect(page.locator("[data-public-search-overlay-input='true']")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(overlay).toHaveCount(0);

  await page.locator(".liax-public-search").click();
  await page.locator("[data-public-search-overlay-input='true']").fill("用户体验");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/zh\/search\?q=/u);
  await expect(page).toHaveTitle(/搜索/u);
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
});
