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

type AdminMockState = {
  attachmentUploadRequests: string[];
  deletedArticleIds: number[];
  momentCreateRequests: unknown[];
  momentPatchRequests: unknown[];
  unknownRequests: string[];
};

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    status
  });
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

async function installAdminMocks(page: Page, state: AdminMockState): Promise<void> {
  let guestbookTestEntries = [
    {
      authorName: "AutoTestBot",
      content: "automated public test",
      createdAt: now,
      deletedAt: null,
      email: null,
      id: 99,
      isPublic: true,
      locale: "zh-CN",
      notifyOnly: false
    }
  ];

  function preflightResponse() {
    return {
      checks: [
        { count: 0, key: "icp", status: "pass" },
        { count: 0, key: "contact", status: "pass" },
        { count: 0, key: "logo", status: "pass" },
        { count: 0, key: "homeCopy", status: "pass" },
        { count: 0, key: "brokenImages", status: "pass" },
        { count: guestbookTestEntries.length, key: "testGuestbook", status: guestbookTestEntries.length > 0 ? "warning" : "pass" }
      ],
      summary: {
        fail: 0,
        pass: guestbookTestEntries.length > 0 ? 5 : 6,
        warning: guestbookTestEntries.length > 0 ? 1 : 0
      }
    };
  }

  await page.route("**/uploads/moment-existing.png", async (route) => {
    await route.fulfill({
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=", "base64"),
      contentType: "image/png"
    });
  });

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

    if (path === "/admin/settings/appearance") {
      await fulfillJson(route, {
        settings: {
          "site.logoAlt": "Liax Space logo",
          "site.logoUrl": "/uploads/site-logo.png",
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

    if (path === "/admin/settings/preflight") {
      await fulfillJson(route, preflightResponse());
      return;
    }

    if (path === "/admin/settings/test-data/guestbook" && method === "GET") {
      await fulfillJson(route, { count: guestbookTestEntries.length, entries: guestbookTestEntries });
      return;
    }

    if (path === "/admin/settings/test-data/guestbook/cleanup" && method === "POST") {
      const deleted = guestbookTestEntries.length;
      guestbookTestEntries = [];
      await fulfillJson(route, { deleted, remaining: 0 });
      return;
    }

    if (path === "/admin/seo/push/submissions") {
      await fulfillJson(route, { submissions: [] });
      return;
    }

    if (path === "/admin/mail/templates") {
      await fulfillJson(route, { templates: [] });
      return;
    }

    if (path === "/admin/mail/logs") {
      await fulfillJson(route, { logs: [] });
      return;
    }

    if (path === "/auth/passkeys") {
      await fulfillJson(route, { passkeys: [] });
      return;
    }

    if (path === "/admin/articles" && method === "GET") {
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
                allowedRoles: ["svip"],
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
          },
          {
            article: {
              authorId: 1,
              coverAttachmentId: null,
              createdAt: now,
              deletedAt: null,
              id: 2,
              status: "draft",
              updatedAt: now
            },
            translations: []
          }
        ].filter((item) => !state.deletedArticleIds.includes(item.article.id))
      });
      return;
    }

    if (path === "/admin/articles/1" && method === "DELETE") {
      state.deletedArticleIds.push(1);
      await fulfillJson(route, {
        article: {
          authorId: 1,
          coverAttachmentId: null,
          createdAt: now,
          deletedAt: now,
          id: 1,
          status: "draft",
          updatedAt: now
        }
      });
      return;
    }

    if (path === "/admin/attachments" && method === "GET") {
      await fulfillJson(route, {
        attachments: [
          {
            createdAt: now,
            deletedAt: null,
            id: 77,
            isUsed: true,
            mimeType: "image/png",
            originalFilename: "moment-existing.png",
            ownerId: 1,
            publicUrl: "/uploads/moment-existing.png",
            sha256: "moment-existing-sha",
            sizeBytes: 12,
            storageKey: "uploads/2026/01/01/moment-existing.png"
          }
        ]
      });
      return;
    }

    if (path === "/admin/attachments" && method === "POST") {
      state.attachmentUploadRequests.push(route.request().headers()["content-type"] ?? "");
      await fulfillJson(route, {
        attachment: {
          createdAt: now,
          deletedAt: null,
          id: 50,
          isUsed: false,
          mimeType: "image/png",
          originalFilename: "moment-paste.png",
          ownerId: 1,
          publicUrl: "/uploads/moment-paste.png",
          sha256: "paste-image-sha",
          sizeBytes: 10,
          storageKey: "uploads/2026/01/01/moment-paste.png"
        },
        markdown: "attachment://50"
      });
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
          },
          {
            builtIn: false,
            createdAt: now,
            displayName: "SSVIP",
            permissions: [],
            roleKey: "ssvip",
            updatedAt: now
          },
          {
            builtIn: false,
            createdAt: now,
            displayName: "SVIP",
            permissions: [],
            roleKey: "svip",
            updatedAt: now
          },
          {
            builtIn: false,
            createdAt: now,
            displayName: "Guest",
            permissions: [],
            roleKey: "guest",
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

    if (path === "/admin/moments" && method === "GET") {
      await fulfillJson(route, {
        moments: [
          {
            authorId: 1,
            content: "A quiet published moment.",
            createdAt: now,
            deletedAt: null,
            id: 1,
            images: ["attachment://77"],
            locale: "en-US",
            publishedAt: now,
            status: "published",
            updatedAt: now
          }
        ]
      });
      return;
    }

    if (path === "/admin/moments" && method === "POST") {
      const body = route.request().postDataJSON();
      state.momentCreateRequests.push(body);
      await fulfillJson(route, {
        moment: {
          authorId: 1,
          content: typeof body.content === "string" ? body.content : "",
          createdAt: now,
          deletedAt: null,
          id: 2,
          images: Array.isArray(body.images) ? body.images : [],
          locale: body.locale === "en-US" ? "en-US" : "zh-CN",
          publishedAt: body.status === "published" ? now : null,
          status: body.status === "published" ? "published" : "draft",
          updatedAt: now
        }
      });
      return;
    }

    if (path === "/admin/moments/1" && method === "PATCH") {
      const body = route.request().postDataJSON();
      state.momentPatchRequests.push(body);
      await fulfillJson(route, {
        moment: {
          authorId: 1,
          content: typeof body.content === "string" ? body.content : "A quiet published moment.",
          createdAt: now,
          deletedAt: null,
          id: 1,
          images: Array.isArray(body.images) ? body.images : [],
          locale: "en-US",
          publishedAt: now,
          status: "published",
          updatedAt: now
        }
      });
      return;
    }

    if (path === "/admin/guestbook") {
      await fulfillJson(route, { entries: [] });
      return;
    }

    state.unknownRequests.push(route.request().url());
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
    const rootStyle = window.getComputedStyle(document.documentElement);
    const root = document.documentElement;
    const body = document.body;

    return {
      backgroundColor: bodyStyle.backgroundColor,
      bodyScrollbarWidth: bodyStyle.scrollbarWidth,
      hasMissingKey: body.innerText.includes("[missing:"),
      horizontalOverflow: Math.max(root.scrollWidth, body.scrollWidth) > window.innerWidth + 1,
      rootScrollbarWidth: rootStyle.scrollbarWidth
    };
  });

  expect(diagnostics.backgroundColor).toBe("rgb(250, 249, 245)");
  expect(diagnostics.bodyScrollbarWidth).toBe("none");
  expect(diagnostics.hasMissingKey).toBe(false);
  expect(diagnostics.horizontalOverflow).toBe(false);
  expect(diagnostics.rootScrollbarWidth).toBe("none");
  await expect(page.locator(".admin-sidebar__logo span")).toHaveText("LS");
  await expect(page.locator(".admin-sidebar__logo")).toBeVisible();
}

async function pasteImageInto(page: Page, selector: string): Promise<void> {
  await page.locator(selector).evaluate((element) => {
    const event = new Event("paste", { bubbles: true, cancelable: true });
    const file = new File(["moment image"], "moment-paste.png", { type: "image/png" });
    Object.defineProperty(event, "clipboardData", {
      value: {
        files: [file]
      }
    });
    element.dispatchEvent(event);
  });
}

test("admin core pages render without console errors or layout regressions", async ({ page }) => {
  test.setTimeout(45_000);

  const consoleIssues: ConsoleIssue[] = [];
  const pageErrors: string[] = [];
  const mockState: AdminMockState = {
    attachmentUploadRequests: [],
    deletedArticleIds: [],
    momentCreateRequests: [],
    momentPatchRequests: [],
    unknownRequests: []
  };

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
  await installAdminMocks(page, mockState);

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

    if (item.hash === "#articles") {
      await expect(page.getByText("中文文章")).toBeVisible();
      const articleTable = page.locator(".admin-article-table");
      const namedRow = articleTable.locator("tbody tr").filter({ hasText: "中文文章" });
      const untitledRow = articleTable.locator("tbody tr").filter({ hasText: "Untitled draft #2" });
      await expect(untitledRow).toContainText("ID 2");
      await expect(untitledRow.getByRole("link", { name: "Edit content" })).toHaveClass(/liax-button--primary/);
      await expect(untitledRow.getByRole("button", { name: "Configure" })).toBeVisible();
      await expect(namedRow.getByRole("link", { name: "Edit content" })).toHaveAttribute("href", "#articles/1/zh-CN/content");
      await expect(namedRow).toContainText("SVIP and above");
      await expect(articleTable).not.toContainText("Edit settings");
      await expect(articleTable).not.toContainText("Open full editor");

      await namedRow.getByRole("button", { name: "Configure" }).click();
      const configModal = page.locator(".admin-article-config-modal");
      await expect(configModal).toBeVisible();
      await expect(configModal.getByText("This only keeps status, cover, visible roles, and deletion.")).toBeVisible();
      await expect(configModal.getByRole("heading", { name: "Article metadata" })).toHaveCount(0);
      await expect(configModal.getByRole("heading", { name: "Markdown file" })).toHaveCount(0);
      await expect(configModal.getByRole("heading", { name: "Danger zone" })).toBeVisible();
      await expect(configModal.getByRole("button", { name: "Delete article" })).toBeVisible();
      await expect(configModal.locator(".admin-article-visibility-summary")).toContainText("SVIP and above");

      const modalDiagnostics = await page.evaluate(() => {
        const backdrop = document.querySelector<HTMLElement>(".admin-modal-backdrop");
        const modal = document.querySelector<HTMLElement>(".admin-article-config-modal");
        const layout = document.querySelector<HTMLElement>(".admin-article-config-layout");
        const basic = document.querySelector<HTMLElement>(".admin-article-config-section--basic");
        const danger = document.querySelector<HTMLElement>(".admin-article-config-section--danger");
        const topbar = document.querySelector<HTMLElement>(".admin-topbar");
        const visibility = document.querySelector<HTMLElement>(".admin-article-config-section--visibility");

        return {
          backdropZIndex: backdrop ? Number(getComputedStyle(backdrop).zIndex) : 0,
          basicWidth: basic ? Math.round(basic.getBoundingClientRect().width) : 0,
          dangerBackground: danger ? getComputedStyle(danger).backgroundColor : null,
          dangerWidth: danger ? Math.round(danger.getBoundingClientRect().width) : 0,
          layoutColumns: layout ? getComputedStyle(layout).gridTemplateColumns.split(" ").length : 0,
          modalWidth: modal ? Math.round(modal.getBoundingClientRect().width) : 0,
          topbarZIndex: topbar ? Number(getComputedStyle(topbar).zIndex) : 0,
          visibilityWidth: visibility ? Math.round(visibility.getBoundingClientRect().width) : 0
        };
      });

      expect(modalDiagnostics.backdropZIndex).toBeGreaterThan(modalDiagnostics.topbarZIndex);
      expect(modalDiagnostics.modalWidth).toBeGreaterThan(820);
      expect(modalDiagnostics.layoutColumns).toBe(2);
      expect(Math.abs(modalDiagnostics.basicWidth - modalDiagnostics.visibilityWidth)).toBeLessThanOrEqual(8);
      expect(modalDiagnostics.dangerWidth).toBeGreaterThan(modalDiagnostics.basicWidth);
      expect(modalDiagnostics.dangerBackground).toBe("rgb(255, 248, 245)");

      await page.mouse.click(12, 12);
      await expect(configModal).toBeHidden();

      await namedRow.getByRole("button", { name: "Configure" }).click();
      await expect(configModal).toBeVisible();
      page.once("dialog", (dialog) => dialog.accept());
      await configModal.getByRole("button", { name: "Delete article" }).click();
      await expect(configModal).toBeHidden();
      await expect(articleTable).not.toContainText("中文文章");
      expect(mockState.deletedArticleIds).toEqual([1]);

      const articleTableDiagnostics = await page.evaluate(() => {
        const titleCell = document.querySelector<HTMLElement>(".admin-article-title-cell");
        const statusCell = document.querySelector<HTMLElement>(".admin-article-status-cell");
        const updatedCell = document.querySelector<HTMLElement>(".admin-article-updated-cell");

        return {
          statusColor: statusCell ? getComputedStyle(statusCell).color : null,
          statusWhiteSpace: statusCell ? getComputedStyle(statusCell).whiteSpace : null,
          titleCellWidth: titleCell ? getComputedStyle(titleCell).width : null,
          updatedFontVariant: updatedCell ? getComputedStyle(updatedCell).fontVariantNumeric : null
        };
      });

      expect(articleTableDiagnostics.statusColor).toBe("rgb(111, 106, 93)");
      expect(articleTableDiagnostics.statusWhiteSpace).toBe("nowrap");
      expect(articleTableDiagnostics.titleCellWidth).not.toBeNull();
      expect(articleTableDiagnostics.updatedFontVariant).toContain("tabular-nums");
    }

    if (item.hash === "#settings") {
      const sitePanel = page.locator(".admin-settings-panel[data-active='true']").filter({ hasText: "Public information" });
      await expect(sitePanel.getByLabel("Chinese contact page content")).toHaveValue("邮箱:hello@example.com\nQQ:123456");
      await expect(sitePanel.getByLabel("English contact page content")).toHaveValue("Email:hello@example.com\nQQ:123456");
      await expect(sitePanel.getByLabel("Global head")).toHaveCount(0);

      await page.getByRole("button", { exact: true, name: "Code" }).click();
      const codePanel = page.locator(".admin-settings-panel[data-active='true']").filter({ hasText: "Code injection" });
      await expect(page.getByRole("button", { exact: true, name: "Code" })).toHaveAttribute("aria-current", "page");
      await expect(codePanel.getByLabel("Global head")).toBeVisible();
      await expect(codePanel.getByLabel("Content page head")).toBeVisible();
      await expect(codePanel.getByLabel("Footer injection")).toBeVisible();
      await expect(codePanel.getByRole("button", { name: "Save code injection" })).toBeVisible();

      await page.getByRole("button", { exact: true, name: "AI" }).click();
      const aiPanel = page.locator(".admin-settings-panel[data-active='true']").filter({ hasText: "AI translation" });
      await expect(aiPanel.getByLabel("Translation provider")).toHaveValue("deepseek");
      await expect(aiPanel.getByLabel("Temperature")).toHaveValue("0.7");

      await page.getByRole("button", { exact: true, name: "Maintenance" }).click();
      const maintenancePanel = page.locator(".admin-settings-panel[data-active='true']").filter({ hasText: "Release maintenance" });
      await expect(maintenancePanel.getByRole("heading", { name: "Preflight check" })).toBeVisible();
      await expect(maintenancePanel.getByText("Matched 1 test guestbook entries.")).toBeVisible();
      await maintenancePanel.getByRole("button", { name: "Run preflight check" }).click();
      await expect(page.getByText("Preflight check completed.")).toBeVisible();
      page.once("dialog", (dialog) => dialog.accept());
      await maintenancePanel.getByRole("button", { name: "Clean test entries" }).click();
      await expect(page.getByText("Cleaned 1 test guestbook entries.")).toBeVisible();
      await expect(maintenancePanel.getByText("Matched 0 test guestbook entries.")).toBeVisible();
    }

    if (item.hash === "#moments") {
      const momentCard = page.locator(".admin-moment-card").first();
      await expect(momentCard).toContainText("A quiet published moment.");
      await expect(momentCard.locator("time")).toBeVisible();
      await expect(momentCard.getByLabel("Image URLs")).toHaveValue("attachment://77");
      await expect(momentCard.locator(".admin-moment-images img")).toHaveAttribute("src", "/uploads/moment-existing.png");
      await momentCard.getByLabel("Moment content").fill("Updated visible content only.");
      await momentCard.getByRole("button", { name: "Save content" }).click();
      await expect(page.getByText("Moment content saved.")).toBeVisible();
      expect(mockState.momentPatchRequests).toEqual([{
        content: "Updated visible content only.",
        images: ["/uploads/moment-existing.png"]
      }]);

      const composer = page.locator(".admin-moment-composer");
      await pasteImageInto(page, ".admin-moment-composer .admin-moment-image-field");
      await expect(composer.getByLabel("Image URLs")).toHaveValue("/uploads/moment-paste.png");
      await expect(page.getByText("Image pasted and uploaded.")).toBeVisible();
      await composer.getByLabel("Moment content").fill("Published with pasted image.");
      await composer.getByLabel("Initial status").selectOption("published");
      await composer.getByRole("button", { name: "Create moment" }).click();
      await expect(page.getByText("Moment published.")).toBeVisible();
      expect(mockState.attachmentUploadRequests).toHaveLength(1);
      expect(mockState.momentCreateRequests).toEqual([{
        content: "Published with pasted image.",
        images: ["/uploads/moment-paste.png"],
        locale: "zh-CN",
        status: "published"
      }]);
    }
  }

  expect(mockState.unknownRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(consoleIssues).toEqual([]);
});
