import { expect, test } from "./fixtures";
import { GUIDE_ITEM_NAME } from "./fake-rakuten-api";
import { GuidePage, GuidesPage } from "./pages";
import { siteUrl } from "../src/site-url";

// The E2E build searches the guides' items in the stand-in for the Rakuten API
// (`scripts/build-e2e.ts`), which finds the same item for every list.

const GUIDE = "/guides/1000yen-items";
const TITLE = "1000円ポッキリで買えるもの";

test("the guide list leads to each guide", async ({ page }) => {
  const guides = await GuidesPage.open(page);
  await expect(page).toHaveTitle("買い物ガイド | ポイントスプリント");
  const guide = await guides.goToGuide(TITLE, GUIDE);
  await expect(guide.heading(1, TITLE)).toBeVisible();
});

test("a guide shows its text and dates, with the items of each list", async ({ page }) => {
  const guide = await GuidePage.open(page, GUIDE);
  await expect(page).toHaveTitle(`${TITLE} | ポイントスプリント`);
  await expect(page.getByText(/公開日 2026年10月8日/)).toBeVisible();
  await expect(guide.heading(2, "お菓子・スイーツ")).toBeVisible();
  await expect(page.getByText(/自分用のおやつにも/)).toBeVisible();
  await expect(guide.heading(2, "美容")).toBeVisible();
  await expect(guide.itemLists).toHaveCount(13);
  await expect(guide.itemLists.first().getByRole("link", { name: GUIDE_ITEM_NAME })).toBeVisible();
});

test("a guide is prerendered as an article", async ({ request }) => {
  const html = await (await request.get(GUIDE)).text();
  expect(html).toContain(`<h1`);
  expect(html).toContain(TITLE);
  expect(html).toContain('<meta property="og:type" content="article"/>');
  expect(html).toContain('<meta property="article:published_time" content="2026-10-08"/>');
  expect(html).toContain('<meta property="article:modified_time" content="2026-10-28"/>');
});

test("the top page has its heading, its description and a guide in the HTML the Worker renders", async ({
  request,
}) => {
  const html = await (await request.get("/")).text();
  expect(html).toMatch(/<h1[^>]*>楽天お買い物マラソンのポイント計算ツール<\/h1>/);
  expect(html).toContain("買うものを入れるだけで、");
  expect(html).toContain(`href="${GUIDE}"`);
  // The cards carry the guides' titles, not their text.
  expect(html).not.toContain("自分用のおやつにも");
});

test("the sitemap lists the guide list and every guide", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(`<loc>${siteUrl}/guides</loc>`);
  expect(sitemap).toContain(
    `<loc>${siteUrl}/guides/1000yen-items</loc><lastmod>2026-10-28</lastmod>`,
  );
  expect(sitemap).toContain(`<loc>${siteUrl}/help</loc>`);
  expect(sitemap).not.toContain("/plan");
});
