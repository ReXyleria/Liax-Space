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

type ArticleTranslation = {
  allowedRoles: string[];
  articleId: number;
  createdAt: string;
  currentHtmlPath: string | null;
  currentVersionId: number | null;
  id: number;
  locale: "zh-CN" | "en-US";
  publishedAt: string | null;
  publishedVersionId: number | null;
  seoDescription: string | null;
  seoTitle: string | null;
  slug: string;
  summary: string | null;
  title: string;
  updatedAt: string;
};

type ArticleVersion = {
  articleId: number;
  contentHash: string;
  createdAt: string;
  createdBy: number;
  customRuleVersion: string | null;
  htmlPath: string | null;
  id: number;
  isPinned: boolean;
  isPublishedSnapshot: boolean;
  locale: "zh-CN" | "en-US";
  mdContent: string;
  renderHash: string | null;
  renderStatus: string;
  rendererVersion: string | null;
  templateVersion: string | null;
  versionNo: number;
};

type ArticleVersionSummary = Omit<ArticleVersion, "mdContent"> & {
  contentSizeBytes: number;
  mdContent?: undefined;
};

type WorkflowState = {
  articleCreated: boolean;
  importRequests: string[];
  metadataRequests: unknown[];
  publishRequests: unknown[];
  saveRequests: unknown[];
  translations: ArticleTranslation[];
  unknownRequests: string[];
  versions: ArticleVersion[];
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

function articleDetail(state: WorkflowState): unknown {
  return {
    article: {
      authorId: 1,
      coverAttachmentId: null,
      createdAt: now,
      deletedAt: null,
      id: 42,
      status: "draft",
      updatedAt: now
    },
    translations: state.translations
  };
}

function createTranslation(input: Record<string, unknown>): ArticleTranslation {
  return {
    allowedRoles: [],
    articleId: 42,
    createdAt: now,
    currentHtmlPath: null,
    currentVersionId: null,
    id: 420,
    locale: input.locale === "en-US" ? "en-US" : "zh-CN",
    publishedAt: null,
    publishedVersionId: null,
    seoDescription: typeof input.seoDescription === "string" ? input.seoDescription : null,
    seoTitle: typeof input.seoTitle === "string" ? input.seoTitle : null,
    slug: typeof input.slug === "string" ? input.slug : "",
    summary: typeof input.summary === "string" ? input.summary : null,
    title: typeof input.title === "string" ? input.title : "",
    updatedAt: now
  };
}

function createVersion(input: Record<string, unknown>, state: WorkflowState): ArticleVersion {
  return {
    articleId: 42,
    contentHash: `${state.versions.length + 1}`.padStart(64, "a"),
    createdAt: now,
    createdBy: 1,
    customRuleVersion: null,
    htmlPath: null,
    id: 9001 + state.versions.length,
    isPinned: false,
    isPublishedSnapshot: false,
    locale: "zh-CN",
    mdContent: typeof input.mdContent === "string" ? input.mdContent : "",
    renderHash: null,
    renderStatus: "pending",
    rendererVersion: null,
    templateVersion: null,
    versionNo: state.versions.length + 1
  };
}

function versionSummary(version: ArticleVersion): ArticleVersionSummary {
  const { mdContent: _mdContent, ...summary } = version;

  return {
    ...summary,
    contentSizeBytes: Buffer.byteLength(version.mdContent, "utf8")
  };
}

async function installArticleWorkflowMocks(page: Page, state: WorkflowState): Promise<void> {
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

    if (path === "/admin/attachments" && method === "GET") {
      await fulfillJson(route, { attachments: [] });
      return;
    }

    if (path === "/admin/articles" && method === "POST") {
      state.articleCreated = true;
      await fulfillJson(route, {
        article: {
          authorId: 1,
          coverAttachmentId: null,
          createdAt: now,
          deletedAt: null,
          id: 42,
          status: "draft",
          updatedAt: now
        }
      });
      return;
    }

    if (path === "/admin/articles" && method === "GET") {
      await fulfillJson(route, {
        articles: state.articleCreated ? [articleDetail(state)] : []
      });
      return;
    }

    if (path === "/admin/articles/42" && method === "GET") {
      await fulfillJson(route, articleDetail(state));
      return;
    }

    if (path === "/admin/articles/42/translations" && method === "POST") {
      const input = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      const translation = createTranslation(input);
      state.metadataRequests.push(input);
      state.translations = [translation, ...state.translations.filter((item) => item.locale !== translation.locale)];
      await fulfillJson(route, { translation });
      return;
    }

    if (path === "/admin/articles/42/zh-CN/versions" && method === "GET") {
      await fulfillJson(route, { versions: state.versions.map(versionSummary) });
      return;
    }

    if (path === "/admin/articles/42/zh-CN/versions" && method === "POST") {
      const input = JSON.parse(route.request().postData() ?? "{}") as Record<string, unknown>;
      const unchanged = state.versions[0]?.mdContent === input.mdContent;
      const version = unchanged ? state.versions[0] : createVersion(input, state);

      state.saveRequests.push(input);

      if (!unchanged) {
        state.versions.unshift(version);
      }

      state.translations = state.translations.map((translation) => (
        translation.locale === "zh-CN"
          ? { ...translation, currentVersionId: version.id, updatedAt: now }
          : translation
      ));

      await fulfillJson(route, { unchanged, version: versionSummary(version) });
      return;
    }

    if (path === "/admin/articles/42/zh-CN/versions/import" && method === "POST") {
      const mdContent = "# Imported heading\n\nBody from imported Markdown.";
      const version = createVersion({ mdContent }, state);

      state.importRequests.push(route.request().headers()["content-type"] ?? "");
      state.versions.unshift(version);
      state.translations = state.translations.map((translation) => (
        translation.locale === "zh-CN"
          ? { ...translation, currentVersionId: version.id, updatedAt: now }
          : translation
      ));

      await fulfillJson(route, { unchanged: false, version: versionSummary(version) });
      return;
    }

    const markdownMatch = path.match(/^\/admin\/articles\/42\/zh-CN\/versions\/(\d+)\/markdown$/);

    if (markdownMatch && method === "GET") {
      const versionId = Number(markdownMatch[1]);
      const markdown = state.versions.find((version) => version.id === versionId)?.mdContent ?? "";
      await route.fulfill({
        body: markdown,
        contentType: "text/plain; charset=utf-8",
        headers: {
          "x-markdown-next-offset": String(markdown.length),
          "x-markdown-total-length": String(markdown.length)
        },
        status: 200
      });
      return;
    }

    if (path === "/admin/roles" && method === "GET") {
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
            displayName: "Viewer",
            permissions: [],
            roleKey: "viewer",
            updatedAt: now
          }
        ]
      });
      return;
    }

    if (path === "/admin/articles/42/zh-CN/publish" && method === "POST") {
      const input = JSON.parse(route.request().postData() ?? "{}") as { allowedRoles?: string[]; versionId?: number };
      const version = state.versions.find((item) => item.id === input.versionId);

      state.publishRequests.push(input);

      if (!version) {
        await fulfillJson(route, { error: { message: "Version not found." } }, 404);
        return;
      }

      const publishedVersion = {
        ...version,
        htmlPath: "zh-CN/articles/42/9001/index.html",
        isPublishedSnapshot: true,
        renderHash: "b".repeat(64),
        renderStatus: "success"
      };

      state.versions = state.versions.map((item) => item.id === publishedVersion.id ? publishedVersion : item);
      state.translations = state.translations.map((translation) => (
        translation.locale === "zh-CN"
          ? {
              ...translation,
              allowedRoles: input.allowedRoles ?? [],
              currentHtmlPath: publishedVersion.htmlPath,
              publishedAt: now,
              publishedVersionId: publishedVersion.id,
              updatedAt: now
            }
          : translation
      ));

      await fulfillJson(route, {
        htmlPath: publishedVersion.htmlPath,
        translation: state.translations.find((translation) => translation.locale === "zh-CN"),
        version: publishedVersion
      });
      return;
    }

    state.unknownRequests.push(`${method} ${route.request().url()}`);
    await fulfillJson(route, { error: { message: `Unexpected workflow request: ${path}` } }, 500);
  });
}

async function loginAsAdmin(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("liax.admin.authToken", "admin-article-workflow-token");
    window.localStorage.setItem("liax.admin.locale", "en-US");
  });
}

function createWorkflowState(): WorkflowState {
  return {
    articleCreated: false,
    importRequests: [],
    metadataRequests: [],
    publishRequests: [],
    saveRequests: [],
    translations: [],
    unknownRequests: [],
    versions: []
  };
}

test("admin article workflow keeps body, metadata, saving, and publishing as separate user actions", async ({ page }) => {
  const state = createWorkflowState();

  await loginAsAdmin(page);
  await installArticleWorkflowMocks(page, state);

  await page.goto("/#articles/new");
  await page.getByRole("button", { name: "Create article body" }).click();
  await expect(page.getByText("Created article: 42")).toBeVisible();
  await page.getByRole("link", { name: "Enter editor" }).click();

  await expect(page.locator("main").getByRole("heading", { name: "Article metadata #42" })).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill("Visual flow article");
  await page.getByLabel("Slug", { exact: true }).fill("visual-flow");
  await page.getByLabel("SEO title").fill("Visual flow SEO");
  await page.getByLabel("SEO description").fill("A concise visual editing flow.");
  await expect(page.getByText("SEO description is present, so summary will be left empty when saved.")).toBeVisible();
  await page.getByRole("button", { name: "Save metadata" }).click();
  await expect(page.getByText("Article metadata saved.")).toBeVisible();
  expect(state.metadataRequests).toHaveLength(1);

  await page.getByRole("link", { name: "Edit content" }).click();
  await expect(page.locator("main").getByRole("heading", { name: "Content editor #42 - zh-CN" })).toBeVisible();
  await expect(page.locator(".admin-visual-editor__surface")).toHaveAttribute("contenteditable", "true");
  await expect(page.locator(".admin-markdown-panel textarea")).toHaveCount(0);

  const editor = page.locator(".admin-visual-editor__surface");
  await editor.fill("# Visual heading\n\nBody from the visual editor.");
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "Save content" }).click();
  await expect(page.getByText("Content saved.")).toBeVisible();

  expect(state.saveRequests).toEqual([
    {
      baseVersionId: null,
      mdContent: "# Visual heading\n\nBody from the visual editor."
    }
  ]);
  expect(state.translations.find((translation) => translation.locale === "zh-CN")?.publishedVersionId).toBeNull();

  await expect(page.locator(".admin-markdown-import--editor")).toBeVisible();
  await expect(page.locator(".admin-markdown-import--editor").getByRole("button", { name: "Upload as new version" })).toHaveCount(1);
  await expect(page.locator(".admin-markdown-import--editor").getByText("Markdown file", { exact: true })).toHaveCount(0);
  await page.locator(".admin-markdown-import--editor input[type='file']").setInputFiles({
    buffer: Buffer.from("# Imported heading\n\nBody from imported Markdown."),
    mimeType: "text/markdown",
    name: "imported.md"
  });
  await expect(page.getByText("Markdown file saved as a new version.")).toBeVisible();
  await expect(page.locator(".admin-visual-editor__surface h1")).toHaveText("Imported heading");
  await expect(page.locator(".admin-visual-editor__surface")).toContainText("Body from imported Markdown.");
  expect(state.importRequests).toHaveLength(1);
  expect(state.translations.find((translation) => translation.locale === "zh-CN")?.currentVersionId).toBe(9002);

  await page.getByRole("link", { name: "Versions" }).click();
  await expect(page.locator("main").getByRole("heading", { name: "Version management #42 - zh-CN" })).toBeVisible();
  await expect(page.locator(".admin-version-summary")).toContainText("Current version ID");
  await expect(page.locator(".admin-version-summary")).toContainText("9002");
  await expect(page.locator(".admin-version-summary")).toContainText("Published version ID");
  await expect(page.locator(".admin-version-summary")).toContainText("No version");

  await page.getByRole("button", { name: "Publish current version" }).click();
  await expect(page.getByText("Published the current language version.")).toBeVisible();
  expect(state.publishRequests).toEqual([{ versionId: 9002 }]);
  expect(state.translations.find((translation) => translation.locale === "zh-CN")?.publishedVersionId).toBe(9002);

  await page.getByRole("link", { name: "Back to content editor" }).click();
  await expect(page.locator(".admin-visual-editor__surface h1")).toHaveText("Imported heading");
  await expect(page.locator(".admin-visual-editor__surface")).toContainText("Body from imported Markdown.");
  expect(state.unknownRequests).toEqual([]);
});

test("large Markdown content uses incremental visual preview instead of source-only mode", async ({ page }) => {
  const state = createWorkflowState();
  const largeMarkdown = [
    "# Large visual manual",
    "",
    ...Array.from({ length: 9000 }, (_item, index) => {
      const section = index + 1;

      return `## Section ${section}\n\nParagraph ${section} with enough body text to make this document large while keeping the preview readable.`;
    })
  ].join("\n\n");
  const version = createVersion({ mdContent: largeMarkdown }, state);
  const translation = createTranslation({
    locale: "zh-CN",
    seoDescription: "Large visual preview",
    seoTitle: "Large visual manual",
    slug: "large-visual-manual",
    title: "Large visual manual"
  });

  state.versions.unshift(version);
  state.translations = [{ ...translation, currentVersionId: version.id }];

  await loginAsAdmin(page);
  await installArticleWorkflowMocks(page, state);

  await page.goto("/#articles/42/zh-CN/content");
  await expect(page.locator("main").getByRole("heading", { name: "Content editor #42 - zh-CN" })).toBeVisible();
  await expect(page.getByText("Large document incremental preview")).toBeVisible();
  await expect(page.getByText(/Read-only incremental preview/)).toBeVisible();
  await expect(page.locator(".admin-markdown-panel textarea")).toHaveCount(0);
  await expect(page.locator(".admin-visual-editor__surface")).toHaveAttribute("contenteditable", "false");
  await expect(page.locator(".admin-visual-editor__surface h1")).toHaveText("Large visual manual");
  await expect(page.locator(".admin-visual-editor__surface")).toContainText("Section 1");

  await page.getByRole("button", { name: "Load more visual content" }).click();
  await expect(page.getByText(/Read-only incremental preview/)).toBeVisible();
  expect(state.unknownRequests).toEqual([]);
});
