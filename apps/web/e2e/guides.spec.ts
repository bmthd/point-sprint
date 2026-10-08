import { expect, test } from "./fixtures";

// The E2E build sends the guides' item searches nowhere (`GUIDE_ITEMS_ENDPOINT`), so that no test
// calls the Rakuten API: every search fails, and the guides read on without their lists. That the
// lists hold the items found is tested by `load-guide.test.ts` and `guide-item-list.browser.test`.

const GUIDE = "/guides/1000yen-items";
const TITLE = "1000円ポッキリで買えるもの";

test("the guide list leads to each guide", async ({ page }) => {
  await page.goto("/guides");
  await expect(page).toHaveTitle("買い物ガイド | ポイントスプリント");
  await page.getByRole("link", { name: TITLE }).click();
  // A page load: the static files are served at the path with a trailing slash.
  await expect(page).toHaveURL(new RegExp(`${GUIDE}/?$`));
  await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
});

test("a guide whose searches failed shows its text and dates without lists", async ({ page }) => {
  await page.goto(GUIDE);
  await expect(page).toHaveTitle(`${TITLE} | ポイントスプリント`);
  await expect(page.getByText(/公開日 2026年10月8日/)).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "食品" })).toBeVisible();
  await expect(page.getByText(/日持ちのする食品を選ぶと/)).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "美容" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "楽天市場の商品（広告）" })).toHaveCount(0);
});

test("a guide is prerendered as an article", async ({ request }) => {
  const html = await (await request.get(GUIDE)).text();
  expect(html).toContain(`<h1`);
  expect(html).toContain(TITLE);
  expect(html).toContain('<meta property="og:type" content="article"/>');
  expect(html).toContain('<meta property="article:modified_time" content="2026-10-08"/>');
});

test("the sitemap lists the guide list and every guide", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>https://point-sprint.bmth.dev/guides</loc>");
  expect(sitemap).toContain(
    "<loc>https://point-sprint.bmth.dev/guides/1000yen-items</loc><lastmod>2026-10-08</lastmod>",
  );
  expect(sitemap).toContain("<loc>https://point-sprint.bmth.dev/help</loc>");
  expect(sitemap).not.toContain("/plan");
});
