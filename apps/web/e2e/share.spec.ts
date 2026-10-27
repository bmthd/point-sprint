import { type Page, expect, test, fixDate } from "./fixtures";
import { SharePage, SitePage, TopPage } from "./pages";
import { siteUrl } from "../src/site-url";

// Where the share buttons are, and what they share. The tests take the Web Share API away, so the
// buttons open the links that every browser has.

/** Creates a plan from the top page. */
async function createPlan(page: Page) {
  await fixDate(page, new Date("2026-10-05T12:00:00+09:00"));
  return (await TopPage.open(page)).createPlan();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined });
    Object.defineProperty(navigator, "canShare", { value: undefined });
  });
});

test("on a wide screen the result's share button ends the right column", async ({ page }) => {
  const plan = await createPlan(page);
  await expect(plan.resultColumn.getByRole("button", { name: "結果をシェア" })).toBeVisible();
  const last = plan.resultColumn.locator(":scope > *").last();
  await expect(last.getByRole("button", { name: "結果をシェア" })).toBeVisible();
});

test("on a phone the result's share button comes after the orders", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const plan = await createPlan(page);
  await expect(plan.shareResultButton).toHaveCount(1);
  const orders = await page.locator("#orders").boundingBox();
  const button = await plan.shareResultButton.boundingBox();
  expect(button?.y ?? 0).toBeGreaterThan((orders?.y ?? 0) + (orders?.height ?? 0));
});

test("the result is shared with its points, linking to its page", async ({ page }) => {
  const plan = await createPlan(page);
  await plan.shareResult();
  const href = await plan.shareLink("X でシェア").getAttribute("href");
  const query = new URL(href ?? "").searchParams;
  expect(query.get("text")).toMatch(/^獲得予定 [\d,]+P.*（ポイントスプリントで計算）$/);
  expect(query.get("url")).toMatch(/^https:\/\/point-sprint\.bmth\.dev\/share\?points=\d+/);
});

test("a shared result's page shows its figures and points social media at their image", async ({
  page,
  request,
}) => {
  const share = await SharePage.open(page, "?points=2600&rate=6.5");
  await expect(page).toHaveTitle("獲得予定 2,600P・実質還元率 6.5% | ポイントスプリント");
  await expect(page.getByRole("img", { name: "獲得予定 2,600P・実質還元率 6.5%" })).toBeVisible();
  expect(await share.ogp("og:title")).toBe("獲得予定 2,600P・実質還元率 6.5% | ポイントスプリント");
  const image = new URL((await share.ogp("og:image")) ?? "");
  expect(image.href).toBe(`${siteUrl}/share/image.png?points=2600&rate=6.5`);

  // The Worker draws the image.
  const response = await request.get(`${image.pathname}${image.search}`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  expect((await response.body()).subarray(1, 4).toString()).toBe("PNG");

  await share.goToCalculator();
});

test("a shared result's link without figures keeps the site's image", async ({ page, request }) => {
  const share = await SharePage.open(page);
  await expect(page.getByText("計算結果が見つかりませんでした。")).toBeVisible();
  expect(await share.ogp("og:image")).toBe(`${siteUrl}/opengraph-image.png`);
  expect((await request.get("/share/image.png")).status()).toBe(404);
});

test("the sidebar shares the site, with the links out from the start", async ({ page }) => {
  for (const path of ["/", "/help", "/terms", "/privacy"]) {
    const section = (await SitePage.open(page, path)).sidebar.shareSite;
    const href = await section
      .getByRole("link", { name: "Facebook でシェア" })
      .getAttribute("href");
    expect(new URL(href ?? "").searchParams.get("u")).toBe(`${siteUrl}/`);
    await expect(section.getByRole("button", { name: "文面とリンクをコピー" })).toBeVisible();
  }
});
