import { newestFirst, notices } from "#/routes/-notices/notices.ts";
import { expect, test } from "./fixtures.ts";
import { NoticesPage, SitePage } from "./pages/index.ts";

// The sidebar lists the guides changed most recently: on a wide screen beside the content of the
// pages that read (the pages for working on a plan have none), on a phone in the header's menu on
// every page. The notices are in full on /notices.

const latest = newestFirst(notices)[0]!;

const withSidebar = ["/help", "/terms", "/privacy", "/inquiry", "/guides", "/notices"];
const withoutSidebar = ["/settings", "/spu", "/plan", "/plan/settings"];

test("the HTML rendered at build time has the recent guides on the pages that read", async ({
  request,
}) => {
  for (const path of withSidebar) {
    const html = await (await request.get(path)).text();
    expect(html, path).toContain("最近更新された記事");
    expect(html, path).toMatch(/href="\/guides\/[a-z0-9-]+"/);
  }
  for (const path of withoutSidebar) {
    const html = await (await request.get(path)).text();
    expect(html, path).not.toContain("最近更新された記事");
  }
});

test("a guide's page leaves itself out of the recent guides", async ({ page }) => {
  const { sidebar } = await SitePage.open(page, "/guides/1000yen-items");
  await expect(sidebar.recentArticles.getByRole("link").first()).toBeVisible();
  await expect(sidebar.recentArticles.locator('a[href="/guides/1000yen-items"]')).toHaveCount(0);
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
  for (const path of withSidebar) {
    const { sidebar, main } = await SitePage.open(page, path);
    await expect(sidebar.recentArticles.getByRole("link").first()).toBeVisible();
    const mainBox = (await main.boundingBox())!;
    const aside = (await sidebar.root.boundingBox())!;
    expect(aside.x, path).toBeGreaterThanOrEqual(mainBox.x + mainBox.width);
    if (["/inquiry", "/guides"].includes(path)) {
      expect(Math.abs(aside.y - mainBox.y), path).toBeLessThan(1);
    }
    expect(aside.width, path).toBe(320);
  }
});

test("the reading card starts at the same height as the first sidebar card", async ({ page }) => {
  for (const path of [
    "/help",
    "/terms",
    "/privacy",
    "/inquiry",
    "/notices",
    "/guides/1000yen-items",
    "/guides/how-much-to-buy",
  ]) {
    const { sidebar } = await SitePage.open(page, path);
    const mainCard = page.locator("main.ui-card__root, main .ui-card__root").first();
    const sidebarCard = sidebar.root.locator(".ui-card__root").first();
    await expect(mainCard).toBeVisible();
    await expect(sidebarCard).toBeVisible();
    const mainBox = (await mainCard.boundingBox())!;
    const asideBox = (await sidebarCard.boundingBox())!;
    expect(Math.abs(asideBox.y - mainBox.y), path).toBeLessThan(1);
  }
});

test("on a phone the sidebar is in the header's menu, on every page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", ...withSidebar, ...withoutSidebar]) {
    const site = await SitePage.open(page, path);
    await expect(site.main.getByText("読み込み中…")).toHaveCount(0);
    await expect(site.sidebar.root).toHaveCount(0);
    const menu = await site.header.openMenu();
    await expect(menu.noticesLink).toBeVisible();
    await expect(menu.recentArticles.getByRole("link").first()).toBeVisible();
    await expect(menu.shareSite).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, path).toBe(false);
  }
});

test("the notices are marked unread until /notices is opened", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const site = await SitePage.open(page, "/help");
  await expect(site.header.menuButton).toHaveAccessibleName("メニュー（未読のお知らせあり）");
  const menu = await site.header.openMenu();
  await expect(menu.noticesLink).toHaveAccessibleName("お知らせ（未読あり）");
  const noticesPage = await menu.goToNotices();
  await expect(noticesPage.latest).toBeVisible();
  await expect(site.header.menuButton).toHaveAccessibleName("メニュー");
});
