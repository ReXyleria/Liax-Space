import playwright from "../../apps/admin/node_modules/@playwright/test/index.js";
import type { Page } from "../../apps/admin/node_modules/@playwright/test/index.js";

const { expect, test } = playwright;

const publicBaseUrl = "http://127.0.0.1:3817";

type ConsoleIssue = {
  text: string;
  type: string;
};

type PublicPageCheck = {
  path: string;
  titlePattern: RegExp;
};

async function expectPublicPageHealthy(page: Page, check: PublicPageCheck): Promise<void> {
  const response = await page.goto(`${publicBaseUrl}${check.path}`);

  expect(response?.ok()).toBe(true);
  expect(response?.headers()["content-type"]).toContain("text/html");
  await expect(page).toHaveTitle(check.titlePattern);
  await expect(page.locator("[data-language-switch-placeholder='true']").first()).toBeVisible();

  const diagnostics = await page.evaluate(() => {
    const bodyStyle = window.getComputedStyle(document.body);
    const root = document.documentElement;
    const body = document.body;
    const header = document.querySelector<HTMLElement>(".liax-public-header");
    const htmlText = document.documentElement.innerHTML;

    return {
      backgroundColor: bodyStyle.backgroundColor,
      hasBackgroundImageUrl: /background-image\s*:\s*url\(/iu.test(htmlText) || /background\s*:\s*url\(/iu.test(htmlText),
      hasMissingKey: body.innerText.includes("[missing:"),
      headerHeight: header?.getBoundingClientRect().height ?? 0,
      horizontalOverflow: Math.max(root.scrollWidth, body.scrollWidth) > window.innerWidth + 1
    };
  });

  expect(diagnostics.backgroundColor).toBe("rgb(250, 249, 245)");
  expect(diagnostics.hasBackgroundImageUrl).toBe(false);
  expect(diagnostics.hasMissingKey).toBe(false);
  expect(diagnostics.headerHeight).toBeGreaterThanOrEqual(72);
  expect(diagnostics.headerHeight).toBeLessThanOrEqual(80);
  expect(diagnostics.horizontalOverflow).toBe(false);
}

test("public pages render as usable HTML without layout regressions", async ({ page }) => {
  const consoleIssues: ConsoleIssue[] = [];
  const pageErrors: string[] = [];

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

  const pages: PublicPageCheck[] = [
    { path: "/zh", titlePattern: /^Liax Space$/u },
    { path: "/en", titlePattern: /^Liax Space$/u },
    { path: "/zh/posts", titlePattern: /文章/u },
    { path: "/en/posts", titlePattern: /Articles/u },
    { path: "/zh/tags", titlePattern: /标签/u },
    { path: "/en/tags", titlePattern: /Tags/u },
    { path: "/zh/moments", titlePattern: /瞬间/u },
    { path: "/en/moments", titlePattern: /Moments/u },
    { path: "/zh/guestbook", titlePattern: /留言/u },
    { path: "/en/guestbook", titlePattern: /Guestbook/u },
    { path: "/zh/archives", titlePattern: /归档/u },
    { path: "/en/archives", titlePattern: /Archives/u },
    { path: "/zh/search?q=e2e", titlePattern: /搜索/u },
    { path: "/en/search?q=e2e", titlePattern: /Search/u }
  ];

  for (const item of pages) {
    await expectPublicPageHealthy(page, item);
  }

  expect(pageErrors).toEqual([]);
  expect(consoleIssues).toEqual([]);
});

test("public moment image failures remove the empty media block", async ({ page }) => {
  await page.route("**/missing-moment-image.png", async (route) => {
    await route.fulfill({ body: "missing", status: 404 });
  });

  await page.setContent(`
    <main>
      <article class="liax-moment-card">
        <p>Broken migrated image</p>
        <div class="liax-moment-images">
          <img alt="" loading="lazy" onerror="const p=this.parentElement;this.remove();if(p&&!p.querySelector('img'))p.remove();" src="http://127.0.0.1:3817/missing-moment-image.png">
        </div>
      </article>
    </main>
  `);

  await expect(page.locator(".liax-moment-images")).toHaveCount(0);
  await expect(page.getByText("Broken migrated image")).toBeVisible();
});

test("public posts and guestbook use compact scan-friendly layouts", async ({ page }) => {
  await page.goto(`${publicBaseUrl}/zh/posts`);
  await expect(page.locator(".liax-article-card").first()).toBeVisible();

  const postLayout = await page.locator(".liax-article-card").first().evaluate((card) => {
    const style = window.getComputedStyle(card);
    const meta = card.querySelector<HTMLElement>(".liax-article-meta");

    return {
      backgroundColor: style.backgroundColor,
      columnCount: style.gridTemplateColumns.split(" ").filter(Boolean).length,
      hasHoverTransition: style.transitionProperty.includes("box-shadow"),
      metaColumn: meta ? window.getComputedStyle(meta).gridColumnStart : ""
    };
  });

  expect(postLayout.backgroundColor).toBe("rgba(255, 255, 255, 0.82)");
  expect(postLayout.columnCount).toBe(2);
  expect(postLayout.hasHoverTransition).toBe(true);
  expect(postLayout.metaColumn).toBe("2");

  await page.goto(`${publicBaseUrl}/zh/guestbook`);
  await expect(page.locator(".liax-guestbook-layout")).toBeVisible();
  await expect(page.locator(".liax-guestbook-form textarea")).toBeVisible();

  const guestbookLayout = await page.evaluate(() => {
    const layout = document.querySelector<HTMLElement>(".liax-guestbook-layout")!;
    const compose = document.querySelector<HTMLElement>(".liax-guestbook-compose")!;
    const stream = document.querySelector<HTMLElement>(".liax-guestbook-stream")!;
    const textarea = document.querySelector<HTMLTextAreaElement>(".liax-guestbook-form textarea")!;
    const layoutStyle = window.getComputedStyle(layout);
    const composeRect = compose.getBoundingClientRect();
    const streamRect = stream.getBoundingClientRect();
    const textareaRect = textarea.getBoundingClientRect();

    return {
      composeNarrowerThanStream: composeRect.width < streamRect.width,
      columnCount: layoutStyle.gridTemplateColumns.split(" ").filter(Boolean).length,
      textareaHeight: textareaRect.height,
      textareaRows: textarea.rows
    };
  });

  expect(guestbookLayout.columnCount).toBe(2);
  expect(guestbookLayout.composeNarrowerThanStream).toBe(true);
  expect(guestbookLayout.textareaRows).toBe(2);
  expect(guestbookLayout.textareaHeight).toBeLessThan(100);
});

test("public search empty state and guestbook validation stay localized", async ({ page }) => {
  await page.goto(`${publicBaseUrl}/zh/search?q=no-such-content-${Date.now()}`);
  await expect(page.locator(".liax-search-empty")).toBeVisible();
  await expect(page.locator(".liax-search-empty")).toContainText("搜索范围");
  await expect(page.locator(".liax-search-empty__links a")).toHaveCount(3);
  await expect(page.locator(".liax-search-empty__links")).toContainText("文章列表");
  await expect(page.locator(".liax-search-empty__links")).toContainText("全部标签");
  await expect(page.locator(".liax-search-empty__links")).toContainText("瞬间");

  await page.goto(`${publicBaseUrl}/zh/guestbook`);
  await page.locator(".liax-guestbook-form input[name='authorName']").fill("本地化校验");
  await page.locator(".liax-guestbook-form button[type='submit']").click();

  await expect(page.locator(".liax-guestbook-form__validation")).toContainText("留言内容不能为空。");
});
