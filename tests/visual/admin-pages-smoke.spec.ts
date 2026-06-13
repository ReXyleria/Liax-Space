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

type ConsoleIssue = {
  text: string;
  type: string;
};

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status
  });
}

async function installAdminMocks(page: Page, unknownRequests: string[]): Promise<void> {
  await page.route("http://127.0.0.1:3000/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

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
      await fulfillJson(route, {
        preferences: {
          avatar_attachment_id: null,
          avatar_public_url: null,
          createdAt: now,
          locale: "zh-CN",
          reduced_motion: false,
          updatedAt: now,
          userId: 1
        }
      });
      return;
    }

    if (path === "/admin/settings/site") {
      await fulfillJson(route, {
        settings: {
          "ai.apiKeyConfigured": true,
          "ai.baseUrl": "https://api.deepseek.com",
          "ai.model": "deepseek-chat",
          "ai.provider": "deepseek",
          "ai.translationTemperature": 0.7,
          "home.brandInfo": "Liax Space",
          "home.contactItems.en-US": "Email:hello@example.com\nQQ:123456",
          "home.contactItems.zh-CN": "邮箱:hello@example.com\nQQ:123456",
          "home.icpNumber": "ICP备案号",
          "home.icpUrl": "https://beian.miit.gov.cn",
          "home.signature": "Timeless Silent Vigil",
          "theme.customColors": {},
          "theme.preset": "warm-minimal"
        }
      });
      return;
    }

    if (path === "/auth/passkeys") {
      await fulfillJson(route, { passkeys: [] });
      return;
    }

    if (path === "/admin/articles") {
      await fulfillJson(route, {
        articles: [
          {
            article: {
              authorId: 1,
              coverAttachmentId: null,
              createdAt: now,
              deletedAt: null,
              id: 1,
              status: "draft",
              updatedAt: now
            },
            translations: [
              {
                articleId: 1,
                createdAt: now,
                currentHtmlPath: null,
                currentVersionId: null,
                id: 1,
                locale: "zh-CN",
                publishedAt: null,
                publishedVersionId: null,
                seoDescription: "中文摘要",
                seoTitle: "中文 SEO",
                slug: "hello-zh",
                summary: "中文摘要",
                title: "中文文章",
                updatedAt: now
              }
            ]
          }
        ]
      });
      return;
    }

    if (path === "/admin/attachments") {
      await fulfillJson(route, { attachments: [] });
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
            displayName: "Editor",
            permissions: ["article:create", "article:update", "article:publish", "attachment:upload"],
            roleKey: "editor",
            updatedAt: now
          }
        ]
      });
      return;
    }

    if (path === "/admin/users") {
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
          },
          {
            createdAt: now,
            disabledAt: null,
            email: "editor@example.com",
            id: 2,
            lastLoginAt: null,
            role: "editor",
            updatedAt: now,
            username: "editor"
          }
        ]
      });
      return;
    }

    if (path === "/admin/tags") {
      await fulfillJson(route, {
        tags: [
          {
            tag: {
              createdAt: now,
              id: 1
            },
            translations: [
              {
                locale: "zh-CN",
                name: "生活",
                slug: "life",
                tagId: 1
              },
              {
                locale: "en-US",
                name: "Life",
                slug: "life-en",
                tagId: 1
              }
            ]
          }
        ]
      });
      return;
    }

    if (path === "/admin/moments") {
      await fulfillJson(route, {
        moments: [
          {
            authorId: 1,
            content: "A quiet published moment.",
            createdAt: now,
            deletedAt: null,
            id: 1,
            locale: "en-US",
            publishedAt: now,
            status: "published",
            updatedAt: now
          }
        ]
      });
      return;
    }

    unknownRequests.push(route.request().url());
    await fulfillJson(route, { error: { message: `Unexpected smoke-test request: ${path}` } }, 500);
  });
}

async function loginAsAdmin(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("liax.admin.authToken", "admin-smoke-token");
    window.localStorage.setItem("liax.admin.locale", "en-US");
  });
}

async function expectAdminPageHealthy(page: Page, expectedHeading: string): Promise<void> {
  await expect(page.locator("main").getByRole("heading", { name: expectedHeading }).first()).toBeVisible();

  const diagnostics = await page.evaluate(() => {
    const bodyStyle = window.getComputedStyle(document.body);
    const root = document.documentElement;
    const body = document.body;

    return {
      backgroundColor: bodyStyle.backgroundColor,
      hasMissingKey: body.innerText.includes("[missing:"),
      horizontalOverflow: Math.max(root.scrollWidth, body.scrollWidth) > window.innerWidth + 1
    };
  });

  expect(diagnostics.backgroundColor).toBe("rgb(250, 249, 245)");
  expect(diagnostics.hasMissingKey).toBe(false);
  expect(diagnostics.horizontalOverflow).toBe(false);
}

test("admin core pages render without console errors or layout regressions", async ({ page }) => {
  const consoleIssues: ConsoleIssue[] = [];
  const pageErrors: string[] = [];
  const unknownRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleIssues.push({
        text: message.text(),
        type: message.type()
      });
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await loginAsAdmin(page);
  await installAdminMocks(page, unknownRequests);

  const pages = [
    { hash: "#articles", heading: "Article list" },
    { hash: "#settings", heading: "Site settings" },
    { hash: "#profile", heading: "Personal settings" },
    { hash: "#theme", heading: "Theme settings" },
    { hash: "#permissions", heading: "Identities and permissions" },
    { hash: "#attachments", heading: "Attachment library" },
    { hash: "#users", heading: "User list" },
    { hash: "#tags", heading: "Tags" },
    { hash: "#moments", heading: "Moments" },
    { hash: "#archives", heading: "Published archives" },
    { hash: "#guestbook", heading: "Guestbook" }
  ];

  for (const item of pages) {
    await page.goto(`/${item.hash}`);
    await expectAdminPageHealthy(page, item.heading);

    if (item.hash === "#settings") {
      await expect(page.getByLabel("Translation provider")).toHaveValue("deepseek");
      await expect(page.getByLabel("Temperature")).toHaveValue("0.7");
      await expect(page.getByLabel("Chinese contact methods")).toHaveValue("邮箱:hello@example.com\nQQ:123456");
      await expect(page.getByLabel("English contact methods")).toHaveValue("Email:hello@example.com\nQQ:123456");
    }
  }

  expect(unknownRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(consoleIssues).toEqual([]);
});
