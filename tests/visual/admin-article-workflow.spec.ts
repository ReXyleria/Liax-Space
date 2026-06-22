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

    if (path === "/admin/translation-jobs" && method === "GET") {
      await fulfillJson(route, { jobs: [] });
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

    if (path === "/admin/articles/42" && method === "PATCH") {
      const input = JSON.parse(route.request().postData() ?? "{}") as { coverAttachmentId?: number | null; status?: string };
      const current = articleDetail(state) as { article: Record<string, unknown> };

      await fulfillJson(route, {
        article: {
          ...current.article,
          coverAttachmentId: input.coverAttachmentId ?? current.article.coverAttachmentId,
          status: input.status ?? current.article.status,
          updatedAt: now
        }
      });
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

    if (path === "/admin/articles/42/translations/zh-CN" && method === "PATCH") {
      const input = JSON.parse(route.request().postData() ?? "{}") as Partial<ArticleTranslation>;
      const translation = state.translations.find((item) => item.locale === "zh-CN");

      if (!translation) {
        await fulfillJson(route, { error: { message: "Translation not found." } }, 404);
        return;
      }

      const nextTranslation = {
        ...translation,
        allowedRoles: input.allowedRoles ?? translation.allowedRoles,
        publishedAt: input.publishedAt === undefined ? translation.publishedAt : input.publishedAt,
        updatedAt: now
      };

      state.translations = state.translations.map((item) => item.locale === "zh-CN" ? nextTranslation : item);
      await fulfillJson(route, { translation: nextTranslation });
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

    if (path === "/admin/articles/42/zh-CN/unpublish" && method === "POST") {
      const translation = state.translations.find((item) => item.locale === "zh-CN");

      if (!translation) {
        await fulfillJson(route, { error: { message: "Translation not found." } }, 404);
        return;
      }

      const nextTranslation = {
        ...translation,
        currentHtmlPath: null,
        publishedAt: null,
        publishedVersionId: null,
        updatedAt: now
      };

      state.translations = state.translations.map((item) => item.locale === "zh-CN" ? nextTranslation : item);
      await fulfillJson(route, { translation: nextTranslation });
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

async function placeCaretAtEditorBlockEdge(page: Page, tagName: string, text: string, edge: "start" | "end"): Promise<void> {
  const placed = await page.locator(".admin-visual-editor__surface").evaluate(
    (editor, input) => {
      const target = Array.from(editor.querySelectorAll(input.tagName)).find((element) => (element.textContent ?? "").trim() === input.text);

      if (!(target instanceof HTMLElement)) {
        return false;
      }

      (editor as HTMLElement).focus();

      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(input.edge === "start");

      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      return true;
    },
    { edge, tagName, text }
  );

  expect(placed).toBe(true);
}

async function placeCaretAtEmptyEditorParagraph(page: Page, index: number, edge: "start" | "end"): Promise<void> {
  const placed = await page.locator(".admin-visual-editor__surface").evaluate(
    (editor, input) => {
      const target = Array.from(editor.querySelectorAll("p"))
        .filter((element) => (element.textContent ?? "").replace(/\u00a0/g, " ").trim().length === 0)
        .at(input.index);

      if (!(target instanceof HTMLElement)) {
        return false;
      }

      (editor as HTMLElement).focus();

      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(input.edge === "start");

      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);

      return true;
    },
    { edge, index }
  );

  expect(placed).toBe(true);
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
  await editor.click();
  let incrementalText = "";
  for (const character of ["a", "b", "c"]) {
    incrementalText += character;
    await page.keyboard.type(character);
    await expect(editor).toHaveText(incrementalText);
    await expect.poll(async () => editor.evaluate((element) => {
      const selection = window.getSelection();

      return {
        anchorOffset: selection?.anchorOffset ?? null,
        anchorText: selection?.anchorNode?.textContent ?? "",
        text: element.textContent ?? ""
      };
    })).toEqual({ anchorOffset: incrementalText.length, anchorText: incrementalText, text: incrementalText });
  }

  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.getByRole("button", { name: "H2" }).click();
  await expect(editor.locator("h2")).toHaveCount(1);
  await expect(editor.locator("h2")).not.toContainText("Heading");
  await page.keyboard.type("Toolbar title");
  await expect(editor.locator("h2")).toHaveText("Toolbar title");

  await page.getByRole("button", { name: "Source" }).click();
  const sourceEditor = page.locator(".admin-markdown-panel textarea");
  await expect(sourceEditor).toBeVisible();
  await sourceEditor.fill("");
  await page.getByRole("button", { name: "H3" }).click();
  await expect(sourceEditor).toHaveValue("### ");
  await expect.poll(async () => sourceEditor.evaluate((element) => (element as HTMLTextAreaElement).selectionStart)).toBe(4);
  await page.keyboard.type("Source title");
  await expect(sourceEditor).toHaveValue("### Source title");
  await expect(sourceEditor).not.toHaveValue(/Heading/);
  await page.getByRole("button", { name: "Visual" }).click();
  await expect(editor.locator("h3")).toHaveText("Source title");

  await editor.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("/h2");
  await page.getByRole("option", { name: /Heading 2/ }).click();
  await expect(editor.locator("h2")).toHaveCount(1);
  await expect(editor.locator("h2")).not.toContainText("Heading");
  await page.keyboard.type("Mouse heading");
  await expect(editor.locator("h2")).toHaveText("Mouse heading");

  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  state.saveRequests = [];
  await page.keyboard.type("/h1");
  await page.keyboard.press("Enter");
  await expect(editor.locator("h1")).toHaveCount(1);
  await expect(editor.locator("h1")).not.toContainText("Heading");
  await page.keyboard.type("Direct title");
  await expect(editor.locator("h1")).toHaveText("Direct title");
  await editor.click({ position: { x: 24, y: 500 } });
  await page.keyboard.type("Body from the visual editor.");
  await page.keyboard.type("``after $ $$");
  await page.waitForTimeout(100);
  await expect(editor).toContainText("Body from the visual editor.``after $ $$");
  await expect.poll(async () => editor.evaluate(() => {
    const selection = window.getSelection();

    return {
      anchorOffset: selection?.anchorOffset ?? null,
      anchorText: selection?.anchorNode?.textContent ?? ""
    };
  })).toEqual({
    anchorOffset: "Body from the visual editor.``after $ $$".length,
    anchorText: "Body from the visual editor.``after $ $$"
  });
  await page.keyboard.press("Control+S");
  await expect(page.getByText("Content saved.")).toBeVisible();

  expect(state.saveRequests).toEqual([
    {
      baseVersionId: null,
      mdContent: "# Direct title\n\nBody from the visual editor.\\`\\`after \\$ \\$\\$"
    }
  ]);
  expect(state.publishRequests).toEqual([]);
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
  await expect(page.locator(".admin-version-summary")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Publish current version" })).toHaveCount(0);

  await page.goto("/#articles");
  await page.getByRole("button", { name: "Configure" }).click();
  const configModal = page.locator(".admin-modal");
  await expect(configModal.getByText("Publish settings")).toBeVisible();
  await expect(configModal.getByText("Unpublished", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Publish current version" }).click();
  await expect(page.getByText("Published the current language version.")).toBeVisible();
  expect(state.publishRequests).toEqual([{ allowedRoles: [], versionId: 9002 }]);
  expect(state.translations.find((translation) => translation.locale === "zh-CN")?.publishedVersionId).toBe(9002);

  await page.locator(".admin-modal").getByRole("link", { name: "Edit content" }).click();
  await expect(page.locator(".admin-visual-editor__surface h1")).toHaveText("Imported heading");
  await expect(page.locator(".admin-visual-editor__surface")).toContainText("Body from imported Markdown.");
  expect(state.unknownRequests).toEqual([]);
});

test("visual editor deletes fenced code blocks at text boundaries without absorbing text", async ({ page }) => {
  const state = createWorkflowState();
  const markdownWithCode = ["Before", "", "```ts", "const value = 1;", "```", "", "After"].join("\n");
  const version = createVersion({ mdContent: markdownWithCode }, state);
  const translation = createTranslation({
    locale: "zh-CN",
    seoDescription: "Code boundary regression",
    seoTitle: "Code boundary article",
    slug: "code-boundary-article",
    title: "Code boundary article"
  });

  state.versions.unshift(version);
  state.translations = [{ ...translation, currentVersionId: version.id }];

  await loginAsAdmin(page);
  await installArticleWorkflowMocks(page, state);

  await page.goto("/#articles/42/zh-CN/content");
  await expect(page.locator("main").getByRole("heading", { name: "Content editor #42 - zh-CN" })).toBeVisible();

  const editor = page.locator(".admin-visual-editor__surface");
  await expect(editor.locator("pre")).toHaveCount(1);
  await expect(editor.locator("pre")).toContainText("const value = 1;");
  await expect(editor).toContainText("After");

  await placeCaretAtEditorBlockEdge(page, "p", "After", "start");
  await page.keyboard.press("Backspace");
  await expect(editor.locator("pre")).toHaveCount(0);
  await expect(editor).toContainText("Before");
  await expect(editor).toContainText("After");

  await page.getByRole("button", { name: "Source" }).click();
  const sourceEditor = page.locator(".admin-markdown-panel textarea");
  await expect(sourceEditor).toHaveValue("Before\n\nAfter");

  await sourceEditor.fill(["Before", "", "```ts", "const value = 1;", "```", "", "<br>", "", "After"].join("\n"));
  await page.getByRole("button", { name: "Visual" }).click();
  await expect(editor.locator("pre")).toHaveCount(1);
  await placeCaretAtEmptyEditorParagraph(page, 0, "start");
  await page.keyboard.press("Backspace");
  await expect(editor.locator("pre")).toHaveCount(0);

  await page.getByRole("button", { name: "Source" }).click();
  await expect(sourceEditor).toHaveValue("Before\n\nAfter");

  await sourceEditor.fill(["Before", "", "<br>", "", "```ts", "const value = 1;", "```", "", "After"].join("\n"));
  await page.getByRole("button", { name: "Visual" }).click();
  await expect(editor.locator("pre")).toHaveCount(1);
  await placeCaretAtEmptyEditorParagraph(page, 0, "start");
  await page.keyboard.press("Delete");
  await expect(editor.locator("pre")).toHaveCount(0);

  await page.getByRole("button", { name: "Source" }).click();
  await expect(sourceEditor).toHaveValue("Before\n\nAfter");

  await sourceEditor.fill(markdownWithCode);
  await page.getByRole("button", { name: "Visual" }).click();
  await expect(editor.locator("pre")).toHaveCount(1);
  await expect(editor.locator("pre")).toContainText("const value = 1;");

  await placeCaretAtEditorBlockEdge(page, "pre", "const value = 1;", "start");
  await page.keyboard.press("Backspace");
  await expect(editor.locator("pre")).toHaveCount(0);
  await expect(editor).toContainText("Before");
  await expect(editor).toContainText("After");

  await page.getByRole("button", { name: "Source" }).click();
  await expect(sourceEditor).toHaveValue("Before\n\nAfter");

  await sourceEditor.fill(markdownWithCode);
  await page.getByRole("button", { name: "Visual" }).click();
  await expect(editor.locator("pre")).toHaveCount(1);
  await expect(editor.locator("pre")).toContainText("const value = 1;");

  await placeCaretAtEditorBlockEdge(page, "pre", "const value = 1;", "end");
  await page.keyboard.press("Delete");
  await expect(editor.locator("pre")).toHaveCount(1);
  await expect(editor.locator("pre")).toHaveText("const value = 1;");
  await expect(editor.locator("p").filter({ hasText: "After" })).toHaveCount(1);

  await page.getByRole("button", { name: "Source" }).click();
  await expect(sourceEditor).toHaveValue(markdownWithCode);

  await sourceEditor.fill(markdownWithCode);
  await page.getByRole("button", { name: "Visual" }).click();
  await expect(editor.locator("pre")).toHaveCount(1);
  await expect(editor.locator("pre")).toContainText("const value = 1;");

  await placeCaretAtEditorBlockEdge(page, "p", "Before", "end");
  await page.keyboard.press("Delete");
  await expect(editor.locator("pre")).toHaveCount(0);
  await expect(editor).toContainText("Before");
  await expect(editor).toContainText("After");

  await page.getByRole("button", { name: "Source" }).click();
  await sourceEditor.fill("");
  await page.getByRole("button", { name: "Visual" }).click();
  await editor.click();
  await page.keyboard.type("Intro");
  await page.getByRole("button", { name: "Code", exact: true }).click();
  await expect(editor.locator("pre")).toHaveCount(1);
  await expect(editor.locator("pre")).toHaveText("code");
  await page.keyboard.type("Tail");

  await page.getByRole("button", { name: "Source" }).click();
  await expect(sourceEditor).toHaveValue("Intro\n\n```\ncode\n```\n\nTail");

  await sourceEditor.fill("");
  await page.getByRole("button", { name: "Visual" }).click();
  await editor.click();
  await page.keyboard.type("/code");
  await page.keyboard.press("Enter");
  await expect(editor.locator("pre")).toHaveCount(1);
  await expect(editor.locator("pre")).toHaveText("code");
  await page.keyboard.type("Slash tail");

  await page.getByRole("button", { name: "Source" }).click();
  await expect(sourceEditor).toHaveValue("```\ncode\n```\n\nSlash tail");

  state.saveRequests = [];
  await page.getByRole("button", { name: "Save content" }).click();
  await expect(page.getByText("Content saved.")).toBeVisible();
  expect(state.saveRequests).toEqual([
    {
      baseVersionId: version.id,
      mdContent: "```\ncode\n```\n\nSlash tail"
    }
  ]);
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
