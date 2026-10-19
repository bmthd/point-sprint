import { expect, test } from "./fixtures";
import { GuidePage, GuidesPage } from "./pages";
import { siteUrl } from "../src/site-url";

// The E2E build sends the guides' item searches nowhere (`GUIDE_ITEMS_ENDPOINT`), so that no test
// calls the Rakuten API: every search fails, and the guides read on without their lists. That the
// lists hold the items found is tested by `load-guide.test.ts` and `guide-item-list.browser.test`.

const GUIDE = "/guides/1000yen-items";
const TITLE = "1000円ポッキリで買えるもの";

test("the guide list leads to each guide", async ({ page }) => {
  const guides = await GuidesPage.open(page);
  await expect(page).toHaveTitle("買い物ガイド | ポイントスプリント");
  const guide = await guides.goToGuide(TITLE, GUIDE);
  await expect(guide.heading(1, TITLE)).toBeVisible();
});

test("a guide whose searches failed shows its text and dates without lists", async ({ page }) => {
  const guide = await GuidePage.open(page, GUIDE);
  await expect(page).toHaveTitle(`${TITLE} | ポイントスプリント`);
  await expect(page.getByText(/公開日 2026年10月8日/)).toBeVisible();
  await expect(guide.heading(2, "食品")).toBeVisible();
  await expect(page.getByText(/日持ちのする食品を選ぶと/)).toBeVisible();
  await expect(guide.heading(2, "美容")).toBeVisible();
  await expect(guide.itemLists).toHaveCount(0);
});

test("a guide is prerendered as an article", async ({ request }) => {
  const html = await (await request.get(GUIDE)).text();
  expect(html).toContain(`<h1`);
  expect(html).toContain(TITLE);
  expect(html).toContain('<meta property="og:type" content="article"/>');
  expect(html).toContain('<meta property="article:modified_time" content="2026-10-19"/>');
});

test("the sitemap lists the guide list and every guide", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(`<loc>${siteUrl}/guides</loc>`);
  expect(sitemap).toContain(
    `<loc>${siteUrl}/guides/1000yen-items</loc><lastmod>2026-10-19</lastmod>`,
  );
  expect(sitemap).toContain(`<loc>${siteUrl}/help</loc>`);
  expect(sitemap).not.toContain("/plan");
});
