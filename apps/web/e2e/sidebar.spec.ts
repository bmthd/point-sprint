import { newestFirst, notices } from "../src/routes/-notices/notices";
import { expect, test } from "./fixtures";
import { NoticesPage, SitePage } from "./pages";

// The notices are in full on /notices. The sidebar lists their headlines: on a wide screen beside
// the content of the pages that read (the pages for working on a plan have none), on a phone in the
// header's menu on every page.

const latest = newestFirst(notices)[0]!;

const withHeadlines = ["/", "/help", "/terms", "/privacy", "/inquiry", "/guides"];
const withoutSidebar = ["/profile", "/plan", "/plan/settings"];

test("the HTML rendered at build time has the headlines on the pages that read", async ({
  request,
}) => {
  for (const path of withHeadlines) {
    const html = await (await request.get(path)).text();
    expect(html, path).toContain(`href="/notices#${latest.id}"`);
  }
  for (const path of [...withoutSidebar, "/notices"]) {
    const html = await (await request.get(path)).text();
    expect(html, path).not.toContain(`href="/notices#${latest.id}"`);
  }
});

test("/notices has every notice in full, and its HTML rendered at build time too", async ({
  page,
  request,
}) => {
  const html = await (await request.get("/notices")).text();
  for (const notice of notices) {
    expect(html).toContain(`id="${notice.id}"`);
    expect(html).toContain(notice.title);
  }
  const article = (await NoticesPage.open(page)).latest;
  await expect(article.getByRole("heading", { level: 2, name: latest.title })).toBeVisible();
  await expect(article.locator("time")).toHaveAttribute("datetime", latest.date);
});

test("on a wide screen the sidebar is a column to the right of the content", async ({ page }) => {
  for (const path of withHeadlines) {
    const { sidebar, main } = await SitePage.open(page, path);
    await expect(sidebar.headlines.getByRole("link", { name: latest.title })).toBeVisible();
    const mainBox = (await main.boundingBox())!;
    const aside = (await sidebar.root.boundingBox())!;
    expect(aside.x, path).toBeGreaterThanOrEqual(mainBox.x + mainBox.width);
    expect(Math.abs(aside.y - mainBox.y), path).toBeLessThan(1);
    expect(aside.width, path).toBe(320);
  }
});

test("on a phone the sidebar is in the header's menu, on every page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [...withHeadlines, ...withoutSidebar]) {
    const site = await SitePage.open(page, path);
    await expect(site.main.getByText("読み込み中…")).toHaveCount(0);
    await expect(site.sidebar.root).toHaveCount(0);
    const menu = await site.header.openMenu();
    await expect(menu.headline(latest.title)).toBeVisible();
    await expect(menu.shareSite).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, path).toBe(false);
  }
});

test("a headline in the sidebar goes to the notice on /notices", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const site = await SitePage.open(page, "/help");
  await expect(site.main.getByText("読み込み中…")).toHaveCount(0);
  const menu = await site.header.openMenu();
  const noticesPage = await menu.goToNotice(latest.title, latest.id);
  await expect(noticesPage.notice(latest.id)).toBeInViewport();
  await expect(noticesPage.sidebar.headlines).toHaveCount(0);
});
