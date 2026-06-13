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
