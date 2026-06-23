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
] as const;

const now = "2026-01-01T00:00:00.000Z";

type AdminUser = {
  createdAt: string;
  disabledAt: string | null;
  email: string;
  id: number;
  lastLoginAt: string | null;
  role: string;
  updatedAt: string;
  username: string;
};

type AdminRole = {
  builtIn: boolean;
  createdAt: string;
  displayName: string;
  permissions: string[];
  roleKey: string;
  updatedAt: string;
};

type AttachmentReference = {
  href: string | null;
  label: string;
  type: "article" | "avatar" | "siteLogo" | "moment";
};

type Attachment = {
  createdAt: string;
  deletedAt: string | null;
  id: number;
  isUsed?: boolean;
  mimeType: string;
  originalFilename: string;
  ownerId: number;
  publicUrl: string | null;
  references?: AttachmentReference[];
  sha256: string;
  sizeBytes: number;
  storageKey: string;
};

type TagDetail = {
  tag: {
    createdAt: string;
    id: number;
  };
  translations: Array<{
    locale: "zh-CN" | "en-US";
    name: string;
    slug: string;
    tagId: number;
  }>;
};

type ManagementState = {
  attachmentDeleteRequests: unknown[];
  attachments: Attachment[];
  roleCreateRequests: unknown[];
  roles: AdminRole[];
  tagCreateRequests: unknown[];
  tagDeleteRequests: number[];
  tagUpdateRequests: unknown[];
  tags: TagDetail[];
  unknownRequests: string[];
  userCreateRequests: unknown[];
  userRoleRequests: unknown[];
  users: AdminUser[];
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
  };
}

function createManagementState(): ManagementState {
  return {
    attachmentDeleteRequests: [],
    attachments: [
      {
        createdAt: now,
        deletedAt: null,
        id: 11,
        isUsed: false,
        mimeType: "image/png",
        originalFilename: "hero.png",
        ownerId: 1,
        publicUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
        sha256: "1".repeat(64),
        sizeBytes: 1200,
        storageKey: "uploads/2026/01/01/hero.png"
      },
      {
        createdAt: now,
        deletedAt: null,
        id: 12,
        isUsed: true,
        mimeType: "image/webp",
        originalFilename: "avatar.webp",
        ownerId: 1,
        publicUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==",
        references: [{ href: "#profile", label: "admin", type: "avatar" }],
        sha256: "2".repeat(64),
        sizeBytes: 800,
        storageKey: "uploads/2026/01/01/avatar.webp"
      },
      {
        createdAt: now,
        deletedAt: null,
        id: 13,
        isUsed: true,
        mimeType: "image/png",
        originalFilename: "missing-url.png",
        ownerId: 1,
        publicUrl: null,
        references: [{ href: "#articles/42/zh-CN/content", label: "Broken media report - zh-CN v2", type: "article" }],
        sha256: "3".repeat(64),
        sizeBytes: 640,
        storageKey: "uploads/2026/01/01/missing-url.png"
      },
      {
        createdAt: now,
        deletedAt: null,
        id: 14,
        isUsed: true,
        mimeType: "image/png",
        originalFilename: "broken-preview.png",
        ownerId: 1,
        publicUrl: "/uploads/broken-preview.png",
        references: [{ href: "#moments", label: "Moment #8 - zh-CN", type: "moment" }],
        sha256: "4".repeat(64),
        sizeBytes: 640,
        storageKey: "uploads/2026/01/01/broken-preview.png"
      }
    ],
    roleCreateRequests: [],
    roles: [
      {
        builtIn: true,
        createdAt: now,
        displayName: "Admin",
        permissions: [...allPermissions],
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
        builtIn: true,
        createdAt: now,
        displayName: "Viewer",
        permissions: [],
        roleKey: "viewer",
        updatedAt: now
      }
    ],
    tagCreateRequests: [],
    tagDeleteRequests: [],
    tagUpdateRequests: [],
    tags: [
      {
        tag: {
          createdAt: now,
          id: 1
        },
        translations: [
          { locale: "zh-CN", name: "生活", slug: "life", tagId: 1 },
          { locale: "en-US", name: "Life", slug: "life-en", tagId: 1 }
        ]
      }
    ],
    unknownRequests: [],
    userCreateRequests: [],
    userRoleRequests: [],
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
  };
}

function readJsonBody(route: Route): Record<string, unknown> {
  return JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
}

async function installManagementMocks(page: Page, state: ManagementState): Promise<void> {
  await page.route("**/uploads/broken-preview.png", async (route) => {
    await route.fulfill({ body: "", status: 404 });
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
          lastLoginAt: now,
          permissions: [...allPermissions],
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

    if (path === "/admin/translation-jobs" && url.searchParams.get("status") === "active") {
      await fulfillJson(route, { jobs: [] });
      return;
    }

    if (path === "/admin/roles" && method === "GET") {
      await fulfillJson(route, {
        permissions: [...allPermissions],
        roles: state.roles
      });
      return;
    }

    if (path === "/admin/roles" && method === "POST") {
      const input = readJsonBody(route);
      const role = {
        builtIn: false,
        createdAt: now,
        displayName: String(input.displayName ?? ""),
        permissions: Array.isArray(input.permissions) ? input.permissions.map(String) : [],
        roleKey: String(input.roleKey ?? ""),
        updatedAt: now
      };

      state.roleCreateRequests.push(input);
      state.roles = [...state.roles, role];
      await fulfillJson(route, { role });
      return;
    }

    if (path === "/admin/users" && method === "GET") {
      const query = url.searchParams.get("search")?.toLowerCase().trim() ?? "";
      const users = query
        ? state.users.filter((user) => `${user.username} ${user.email}`.toLowerCase().includes(query))
        : state.users;

      await fulfillJson(route, { users });
      return;
    }

    if (path === "/admin/users" && method === "POST") {
      const input = readJsonBody(route);
      const user = {
        createdAt: now,
        disabledAt: null,
        email: String(input.email ?? ""),
        id: state.users.length + 1,
        lastLoginAt: null,
        role: String(input.role ?? "viewer"),
        updatedAt: now,
        username: String(input.username ?? "")
      };

      state.userCreateRequests.push(input);
      state.users = [...state.users, user];
      await fulfillJson(route, { user });
      return;
    }

    if (path === "/admin/users/batch/role" && method === "POST") {
      const input = readJsonBody(route);
      const ids = Array.isArray(input.ids) ? input.ids.map(Number) : [];
      const role = String(input.role ?? "viewer");
      state.userRoleRequests.push(input);
      state.users = state.users.map((user) => ids.includes(user.id) ? { ...user, role } : user);
      await fulfillJson(route, { updated: ids.length });
      return;
    }

    if (path === "/admin/attachments" && method === "GET") {
      const query = url.searchParams.get("search")?.toLowerCase().trim() ?? "";
      const attachments = query
        ? state.attachments.filter((attachment) => attachment.originalFilename.toLowerCase().includes(query))
        : state.attachments;

      await fulfillJson(route, { attachments });
      return;
    }

    if (path === "/admin/attachments" && method === "DELETE") {
      const input = readJsonBody(route);
      const ids = Array.isArray(input.ids) ? input.ids.map(Number) : [];

      state.attachmentDeleteRequests.push(input);
      state.attachments = state.attachments.filter((attachment) => !ids.includes(attachment.id));
      await fulfillJson(route, { deleted: ids.length });
      return;
    }

    if (path === "/admin/tags" && method === "GET") {
      await fulfillJson(route, { tags: state.tags });
      return;
    }

    if (path === "/admin/tags" && method === "POST") {
      const input = readJsonBody(route);
      const tagId = state.tags.length + 1;
      const translations = Array.isArray(input.translations)
        ? input.translations.map((translation) => ({
            locale: translation.locale === "en-US" ? "en-US" as const : "zh-CN" as const,
            name: String(translation.name ?? ""),
            slug: String(translation.slug ?? ""),
            tagId
          }))
        : [];
      const tag = {
        tag: {
          createdAt: now,
          id: tagId
        },
        translations
      };

      state.tagCreateRequests.push(input);
      state.tags = [tag, ...state.tags];
      await fulfillJson(route, { tag });
      return;
    }

    const tagTranslationMatch = /^\/admin\/tags\/(\d+)\/translations\/(zh-CN|en-US)$/u.exec(path);
    if (tagTranslationMatch && method === "PATCH") {
      const tagId = Number(tagTranslationMatch[1]);
      const locale = tagTranslationMatch[2] as "zh-CN" | "en-US";
      const input = readJsonBody(route);

      state.tagUpdateRequests.push({ ...input, locale, tagId });
      state.tags = state.tags.map((tag) => {
        if (tag.tag.id !== tagId) {
          return tag;
        }

        return {
          ...tag,
          translations: tag.translations.map((translation) => (
            translation.locale === locale
              ? {
                  ...translation,
                  name: String(input.name ?? translation.name),
                  slug: String(input.slug ?? translation.slug)
                }
              : translation
          ))
        };
      });

      await fulfillJson(route, { tag: state.tags.find((tag) => tag.tag.id === tagId) });
      return;
    }

    const tagDeleteMatch = /^\/admin\/tags\/(\d+)$/u.exec(path);
    if (tagDeleteMatch && method === "DELETE") {
      const tagId = Number(tagDeleteMatch[1]);
      const tag = state.tags.find((item) => item.tag.id === tagId);

      state.tagDeleteRequests.push(tagId);
      state.tags = state.tags.filter((item) => item.tag.id !== tagId);
      await fulfillJson(route, { tag });
      return;
    }

    state.unknownRequests.push(`${method} ${route.request().url()}`);
    await fulfillJson(route, { error: { message: `Unexpected management request: ${path}` } }, 500);
  });
}

async function loginAsAdmin(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("liax.admin.authToken", "admin-management-test-token");
    window.localStorage.setItem("liax.admin.locale", "en-US");
  });
}

test("user management keeps creation, validation, and batch role changes explicit", async ({ page }) => {
  const state = createManagementState();

  await loginAsAdmin(page);
  await installManagementMocks(page, state);

  await page.goto("/#users");
  await expect(page.locator("main").getByRole("heading", { name: "User list" })).toBeVisible();

  await page.getByRole("button", { name: "Batch change role" }).click();
  await expect(page.getByText("Select at least one user first.")).toBeVisible();
  expect(state.userRoleRequests).toEqual([]);

  await page.locator(".admin-page-actions").getByRole("button", { name: "Create user" }).click();
  const dialog = page.getByRole("dialog", { name: "Create user" });

  await dialog.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText("Fill username, email, and initial password.")).toBeVisible();
  expect(state.userCreateRequests).toEqual([]);

  await dialog.getByLabel("Username").fill("writer");
  await dialog.getByLabel("Email").fill("writer@example.com");
  await dialog.getByLabel("Initial password").fill("local-only-password");
  await dialog.getByLabel("Role").selectOption("editor");
  await dialog.getByRole("button", { name: "Create user" }).click();
  await expect(page.getByText("Created user: writer")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "writer@example.com" })).toBeVisible();
  expect(state.userCreateRequests).toEqual([
    {
      email: "writer@example.com",
      password: "local-only-password",
      role: "editor",
      username: "writer"
    }
  ]);

  await page.getByLabel("Select user #3").check();
  await page.locator(".admin-users-toolbar select").selectOption("viewer");
  await page.getByRole("button", { name: "Batch change role" }).click();
  await expect(page.getByText("Updated roles: 1")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "writer@example.com" })).toContainText("Viewer");
  expect(state.userRoleRequests).toEqual([{ ids: [3], role: "viewer" }]);
  expect(state.unknownRequests).toEqual([]);
});

test("roles, tags, and attachment library mutate only after deliberate user actions", async ({ page }) => {
  const state = createManagementState();

  await loginAsAdmin(page);
  await installManagementMocks(page, state);

  await page.goto("/#permissions");
  await expect(page.locator("main").getByRole("heading", { name: "Identities and permissions" })).toBeVisible();
  await page.getByRole("button", { name: "Create identity" }).click();
  const roleDialog = page.getByRole("dialog", { name: "Create identity" });
  await roleDialog.getByLabel("Identity key").fill("content-manager");
  await roleDialog.getByLabel("Display name").fill("Content manager");
  await roleDialog.locator("label").filter({ hasText: "Create articles" }).locator("input").check();
  await roleDialog.locator("label").filter({ hasText: "Upload attachments" }).locator("input").check();
  await roleDialog.getByRole("button", { name: "Save identity" }).click();
  await expect(page.getByText("Identity saved.")).toBeVisible();
  await expect(page.locator(".admin-role-card").filter({ hasText: "content-manager" })).toBeVisible();
  expect(state.roleCreateRequests).toEqual([
    {
      displayName: "Content manager",
      permissions: ["article:create", "attachment:upload"],
      roleKey: "content-manager"
    }
  ]);

  await page.goto("/#tags");
  await expect(page.locator("main h2").filter({ hasText: "Tags" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create tag" })).toBeDisabled();
  await page.getByLabel("Chinese name").fill("设计");
  await page.getByLabel("English name").fill("Design");
  await page.getByRole("button", { name: "Create tag" }).click();
  await expect(page.getByText("Tag created.")).toBeVisible();
  expect(state.tagCreateRequests).toHaveLength(1);

  const newTag = page.locator(".admin-taxonomy-item").filter({ hasText: "#2" });
  await expect(newTag).toContainText("Design");
  await newTag.getByRole("button", { name: "Edit" }).click();
  await newTag.getByLabel("English name").fill("Design Notes");
  await newTag.getByRole("button", { name: "Save tag" }).click();
  await expect(page.getByText("Tag updated.")).toBeVisible();
  expect(state.tagUpdateRequests).toEqual([
    { locale: "zh-CN", name: "设计", tagId: 2 },
    { locale: "en-US", name: "Design Notes", tagId: 2 }
  ]);

  await newTag.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Tag deleted.")).toBeVisible();
  await expect(newTag).toHaveCount(0);
  expect(state.tagDeleteRequests).toEqual([2]);

  await page.goto("/#attachments");
  await expect(page.locator("main h2").filter({ hasText: "Attachment library" })).toBeVisible();

  const referencedCard = page.locator(".admin-attachment-card").filter({ hasText: "avatar.webp" });
  await expect(referencedCard).toContainText("Referenced");
  await expect(referencedCard).toContainText("Resource available");
  await expect(referencedCard).toContainText("Avatar - admin");

  const missingUrlCard = page.locator(".admin-attachment-card").filter({ hasText: "missing-url.png" });
  await expect(missingUrlCard).toContainText("Missing public URL");
  await expect(missingUrlCard).toContainText("Article - Broken media report");
  await expect(missingUrlCard.locator(".admin-attachment-preview--empty")).toContainText("Missing public URL");
  await expect(missingUrlCard.locator(".admin-attachment-preview--empty")).toHaveAttribute("data-state", "missing");

  const brokenPreviewCard = page.locator(".admin-attachment-card").filter({ hasText: "broken-preview.png" });
  await expect(brokenPreviewCard).toContainText("Preview failed");
  await expect(brokenPreviewCard).toContainText("Moment - Moment #8");
  await expect(brokenPreviewCard.locator(".admin-attachment-preview--empty")).toContainText("Preview failed");
  await expect(brokenPreviewCard.locator(".admin-attachment-preview--empty")).toHaveAttribute("data-state", "failed");

  const cleanUnusedButton = page.getByRole("button", { name: "Clean selected unused attachments" });
  await expect(cleanUnusedButton).toBeDisabled();
  await expect(cleanUnusedButton).toHaveClass(/liax-button--danger/);
  await page.getByLabel("Select attachment hero.png").check();
  await expect(cleanUnusedButton).toBeEnabled();
  await expect(cleanUnusedButton).toHaveCSS("background-color", "rgb(255, 240, 236)");
  page.once("dialog", (dialog) => dialog.accept());
  await cleanUnusedButton.click();
  await expect(page.getByText("Unused attachments deleted: 1")).toBeVisible();
  await expect(page.getByText("hero.png")).toHaveCount(0);
  expect(state.attachmentDeleteRequests).toEqual([{ ids: [11] }]);
  expect(state.unknownRequests).toEqual([]);
});

test("mobile admin keeps navigation collapsed and permission save reachable", async ({ page }) => {
  const state = createManagementState();

  await page.setViewportSize({ height: 420, width: 390 });
  await loginAsAdmin(page);
  await installManagementMocks(page, state);

  await page.goto("/#permissions");
  await expect(page.locator("main").getByRole("heading", { name: "Identities and permissions" })).toBeVisible();
  await expect(page.getByText("Small screens are for quick review and light management.")).toBeVisible();
  await expect(page.locator(".admin-sidebar")).toBeHidden();

  await page.getByRole("button", { name: "Open main navigation" }).click();
  await expect(page.locator(".admin-sidebar")).toBeVisible();
  await page.getByRole("button", { name: "Close main navigation" }).click();
  await expect(page.locator(".admin-sidebar")).toBeHidden();

  await page.getByRole("button", { name: "Create identity" }).click();
  const roleDialog = page.getByRole("dialog", { name: "Create identity" });
  await roleDialog.getByLabel("Identity key").fill("mobile-manager");
  await roleDialog.getByLabel("Display name").fill("Mobile manager");
  await roleDialog.locator("label").filter({ hasText: "Create articles" }).locator("input").check();

  const saveButton = roleDialog.getByRole("button", { name: "Save identity" });
  const saveButtonBox = await saveButton.boundingBox();
  const viewport = page.viewportSize();

  if (!saveButtonBox || !viewport) {
    throw new Error("Save identity button must be measurable in the mobile role dialog.");
  }

  expect(saveButtonBox.y).toBeGreaterThanOrEqual(0);
  expect(saveButtonBox.y + saveButtonBox.height).toBeLessThanOrEqual(viewport.height);

  await saveButton.click();
  await expect(page.getByText("Identity saved.")).toBeVisible();
  expect(state.roleCreateRequests).toEqual([
    {
      displayName: "Mobile manager",
      permissions: ["article:create"],
      roleKey: "mobile-manager"
    }
  ]);
  expect(state.unknownRequests).toEqual([]);
});
