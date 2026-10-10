import { newestFirst, notices } from "../src/routes/-notices/notices";
import { type Page, expect, test } from "./fixtures";

// The notices are in full on /notices. The sidebar lists their headlines: on a wide screen beside
// the content of the pages that read (the pages for working on a plan have none), on a phone in the
// header's menu on every page.

const latest = newestFirst(notices)[0]!;

const withHeadlines = ["/", "/help", "/terms", "/privacy", "/inquiry", "/guides"];
const withoutSidebar = ["/profile", "/plan", "/plan/settings"];

const sidebar = (page: Page) => page.getByRole("complementary", { name: "サイドバー" });
/** Opens the header's menu. Retried: a click before the prerendered page hydrates does nothing. */
async function openMenu(page: Page) {
  const menu = page.getByRole("dialog", { name: "メニュー" });
  await expect(async () => {
    await page.getByRole("banner").getByRole("button", { name: "メニュー" }).click();
    await expect(menu).toBeVisible({ timeout: 1000 });
  }).toPass();
  return menu;
}

const headlines = (page: Page) => sidebar(page).getByRole("region", { name: "お知らせ" });

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
  await page.goto("/notices");
  const article = page.getByRole("main").getByRole("article").first();
  await expect(article.getByRole("heading", { level: 2, name: latest.title })).toBeVisible();
  await expect(article.locator("time")).toHaveAttribute("datetime", latest.date);
});

test("on a wide screen the sidebar is a column to the right of the content", async ({ page }) => {
  for (const path of withHeadlines) {
    await page.goto(path);
    await expect(headlines(page).getByRole("link", { name: latest.title })).toBeVisible();
    const main = (await page.getByRole("main").boundingBox())!;
    const aside = (await sidebar(page).boundingBox())!;
    expect(aside.x, path).toBeGreaterThanOrEqual(main.x + main.width);
    expect(Math.abs(aside.y - main.y), path).toBeLessThan(1);
    expect(aside.width, path).toBe(320);
  }
});

test("on a phone the sidebar is in the header's menu, on every page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [...withHeadlines, ...withoutSidebar]) {
    await page.goto(path);
    await expect(page.getByRole("main").getByText("読み込み中…")).toHaveCount(0);
    await expect(sidebar(page)).toHaveCount(0);
    const menu = await openMenu(page);
    await expect(menu.getByRole("link", { name: latest.title })).toBeVisible();
    await expect(menu.getByRole("region", { name: "このサイトをシェア" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, path).toBe(false);
  }
});

test("a headline in the sidebar goes to the notice on /notices", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/help");
  await expect(page.getByRole("main").getByText("読み込み中…")).toHaveCount(0);
  await openMenu(page);
  await headlines(page).getByRole("link", { name: latest.title }).click();
  await expect(page).toHaveURL(new RegExp(`/notices/?#${latest.id}$`));
  await expect(page.locator(`#${latest.id}`)).toBeInViewport();
  await expect(sidebar(page).getByRole("region", { name: "お知らせ" })).toHaveCount(0);
});
