import { newestFirst, notices } from "../src/routes/(site)/-notices/notices";
import { type Page, expect, test } from "./fixtures";

// The sidebar with the notices: on the pages that read, beside the content on a wide screen and
// under it on a phone.

const latest = newestFirst(notices)[0]!;

const withSidebar = ["/", "/help", "/terms", "/privacy", "/inquiry"];
const withoutSidebar = ["/profile", "/plan", "/plan/settings"];

const sidebar = (page: Page) => page.getByRole("complementary", { name: "サイドバー" });
const noticeSection = (page: Page) => sidebar(page).getByRole("region", { name: "お知らせ" });

test("the HTML rendered at build time has the notices on the pages with the sidebar", async ({
  request,
}) => {
  for (const path of withSidebar) {
    const html = await (await request.get(path)).text();
    expect(html, path).toContain('id="notices"');
    expect(html, path).toContain(latest.title);
  }
  for (const path of withoutSidebar) {
    const html = await (await request.get(path)).text();
    expect(html, path).not.toContain('id="notices"');
  }
});

test("on a wide screen the sidebar is a column to the right of the content", async ({ page }) => {
  for (const path of withSidebar) {
    await page.goto(path);
    await expect(noticeSection(page).getByRole("heading", { name: latest.title })).toBeVisible();
    const main = (await page.getByRole("main").boundingBox())!;
    const aside = (await sidebar(page).boundingBox())!;
    expect(aside.x, path).toBeGreaterThanOrEqual(main.x + main.width);
    expect(Math.abs(aside.y - main.y), path).toBeLessThan(1);
    expect(aside.width, path).toBe(320);
  }
});

test("on a phone the sidebar follows the content, above the footer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of withSidebar) {
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

test("the footer's お知らせ goes to the notices on the top page", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/help");
  await expect(page.getByRole("main").getByText("読み込み中…")).toHaveCount(0);
  await page.getByRole("contentinfo").getByRole("link", { name: "お知らせ" }).click();
  await expect(page).toHaveURL(/\/#notices$/);
  await expect(noticeSection(page)).toBeInViewport();
});
