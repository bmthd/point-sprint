import { expect, test } from "./fixtures";

// The E2E build answers the guides' item searches from `item-search-fixture.json`: the food and
// daily goods lists find items, and the beauty list's call fails.

const GUIDE = "/guides/1000yen-items";
const TITLE = "1000円ポッキリで買えるもの";

test("the guide list leads to each guide", async ({ page }) => {
  await page.goto("/guides");
  await expect(page).toHaveTitle("買い物ガイド | ポイントスプリント");
  await page.getByRole("link", { name: TITLE }).click();
  await expect(page).toHaveURL(GUIDE);
  await expect(page.getByRole("heading", { level: 1, name: TITLE })).toBeVisible();
});

test("a guide shows its text, its dates and the lists the build found items for", async ({
  page,
}) => {
  await page.goto(GUIDE);
  await expect(page).toHaveTitle(`${TITLE} | ポイントスプリント`);
  await expect(page.getByText(/公開日 2026年10月8日/)).toBeVisible();

  const lists = page.getByRole("complementary", { name: "楽天市場の商品（広告）" });
  await expect(lists).toHaveCount(2);
  const food = lists.first();
  await expect(food.getByText("PR", { exact: true })).toBeVisible();
  await expect(food.getByText(/時点のものです/)).toBeVisible();
  const link = food.getByRole("link", { name: "E2E はとむぎ粉 330g" });
  await expect(link).toHaveAttribute("href", /^https:\/\/hb\.afl\.rakuten\.co\.jp\//);
  await expect(link).toHaveAttribute("rel", "sponsored noopener");
  await expect(
    lists.nth(1).getByRole("link", { name: "E2E フェイスタオル 5枚セット" }),
  ).toBeVisible();

  // The beauty list's call failed: its section reads on without items.
  await expect(page.getByRole("heading", { level: 2, name: "美容" })).toBeVisible();
  await expect(page.getByText(/お試しサイズも/)).toBeVisible();
});

test("the items are in the prerendered HTML, before any script runs", async ({ request }) => {
  const html = await (await request.get(GUIDE)).text();
  expect(html).toContain('<meta property="og:type" content="article"/>');
  expect(html).toContain("E2E はとむぎ粉 330g");
  expect(html).toContain(
    'href="https://hb.afl.rakuten.co.jp/hgc/e2e/?pc=https%3A%2F%2Fitem.rakuten.co.jp%2Fe2e-food%2Fhatomugi%2F"',
  );
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
