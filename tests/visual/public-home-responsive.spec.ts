import playwright from "../../apps/admin/node_modules/@playwright/test/index.js";
import type { Page } from "../../apps/admin/node_modules/@playwright/test/index.js";

const { expect, test } = playwright;

const publicBaseUrl = "http://127.0.0.1:3817";

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    return Math.max(root.scrollWidth, body.scrollWidth) > window.innerWidth + 1;
  });

  expect(overflow).toBe(false);
}

async function expectPublicHomeStructure(page: Page, path: "/zh" | "/en"): Promise<void> {
  await page.goto(`${publicBaseUrl}${path}`);
  await expect(page.locator(".liax-public-header")).toBeVisible();
  await expect(page.locator(".liax-home-title")).toBeVisible();
  await expect(page.locator(".liax-home-contact")).toBeVisible();
  await expect(page.locator(".liax-home-contact__item")).not.toHaveCount(0);
  await expect(page.locator(".liax-home-footer a[target='_blank']")).toBeVisible();

  const details = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(".liax-public-header");
    const title = document.querySelector<HTMLElement>(".liax-home-title");
    const contact = document.querySelector<HTMLElement>(".liax-home-contact");
    const footerLink = document.querySelector<HTMLAnchorElement>(".liax-home-footer a[target='_blank']");
    const bodyText = document.body.innerText;
    const contactRect = contact?.getBoundingClientRect();
    const titleRect = title?.getBoundingClientRect();

    return {
      bodyBackground: window.getComputedStyle(document.body).backgroundColor,
      contactBoxBackground: contact ? window.getComputedStyle(contact).backgroundColor : "",
      contactBoxBorder: contact ? window.getComputedStyle(contact).borderTopColor : "",
      contactLeft: contactRect?.left ?? 0,
      contactTop: contactRect?.top ?? 0,
      footerHref: footerLink?.href ?? "",
      hasContactTitle: bodyText.includes("联系方式标题") || bodyText.includes("Contact title"),
      headerHeight: header?.getBoundingClientRect().height ?? 0,
      titleText: title?.innerText.trim() ?? "",
      titleBottom: titleRect ? titleRect.top + titleRect.height : 0
    };
  });

  expect(details.bodyBackground).toBe("rgb(250, 249, 245)");
  expect(details.contactBoxBackground).toBe("rgb(255, 255, 255)");
  expect(details.contactBoxBorder).toBe("rgb(209, 207, 197)");
  expect(details.footerHref).toMatch(/^https?:\/\//u);
  expect(details.hasContactTitle).toBe(false);
  expect(details.headerHeight).toBeGreaterThanOrEqual(72);
  expect(details.headerHeight).toBeLessThanOrEqual(80);
  expect(details.titleText.length).toBeGreaterThan(0);
  await expectNoHorizontalOverflow(page);
}

test("public home keeps the signature, contact box, and ICP link usable", async ({ page }) => {
  await expectPublicHomeStructure(page, "/zh");
  await expect(page.locator(".liax-home-author")).toContainText("作者");
  await expect(page.locator(".liax-home-contact")).toContainText(/邮箱|Email|QQ|Website|主页/u);

  await expectPublicHomeStructure(page, "/en");
  await expect(page.locator(".liax-home-author")).toContainText("Author");
  await expect(page.locator(".liax-home-contact")).toContainText(/Email|QQ|Website/u);
});

test("public home remains composed on mobile without overflow", async ({ page }) => {
  await page.setViewportSize({ height: 760, width: 390 });
  await page.goto(`${publicBaseUrl}/zh`);
  await expect(page.locator(".liax-public-header")).toBeVisible();
  await expect(page.locator(".liax-home-contact")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const mobileLayout = await page.evaluate(() => {
    const title = document.querySelector<HTMLElement>(".liax-home-title")!.getBoundingClientRect();
    const contact = document.querySelector<HTMLElement>(".liax-home-contact")!.getBoundingClientRect();
    const header = document.querySelector<HTMLElement>(".liax-public-header")!.getBoundingClientRect();

    return {
      contactBelowTitle: contact.top > title.top,
      contactFitsViewport: contact.left >= 0 && contact.right <= window.innerWidth,
      headerHeight: header.height,
      titleFitsViewport: title.left >= 0 && title.right <= window.innerWidth
    };
  });

  expect(mobileLayout.contactBelowTitle).toBe(true);
  expect(mobileLayout.contactFitsViewport).toBe(true);
  expect(mobileLayout.headerHeight).toBeGreaterThanOrEqual(72);
  expect(mobileLayout.headerHeight).toBeLessThanOrEqual(80);
  expect(mobileLayout.titleFitsViewport).toBe(true);
});
