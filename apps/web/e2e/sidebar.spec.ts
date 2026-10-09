import { newestFirst, notices } from "../src/routes/(site)/-notices/notices";
import { type Page, expect, test } from "./fixtures";

// The notices are in full on /notices. The sidebar, on the pages that read, lists their headlines
// beside the content on a wide screen and under it on a phone; the pages for working on a plan
// have neither.

const latest = newestFirst(notices)[0]!;

const withHeadlines = ["/", "/help", "/terms", "/privacy", "/inquiry", "/guides"];
const withoutSidebar = ["/profile", "/plan", "/plan/settings"];

const sidebar = (page: Page) => page.getByRole("complementary", { name: "サイドバー" });
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

test("on a phone the sidebar follows the content, above the footer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of withHeadlines) {
    await page.goto(path);
    const main = (await page.getByRole("main").boundingBox())!;
    const aside = (await sidebar(page).boundingBox())!;
    const footer = (await page.getByRole("contentinfo").boundingBox())!;
    expect(aside.y, path).toBeGreaterThanOrEqual(main.y + main.height);
    expect(footer.y, path).toBeGreaterThanOrEqual(aside.y + aside.height);
    expect(aside.width, path).toBe(main.width);
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
  await headlines(page).getByRole("link", { name: latest.title }).click();
  await expect(page).toHaveURL(new RegExp(`/notices/?#${latest.id}$`));
  await expect(page.locator(`#${latest.id}`)).toBeInViewport();
  await expect(sidebar(page).getByRole("region", { name: "お知らせ" })).toHaveCount(0);
});
