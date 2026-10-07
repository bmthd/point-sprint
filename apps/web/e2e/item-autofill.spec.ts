import { RAKUTEN_API, expect, test } from "./fixtures";

// `pnpm test:e2e` builds with stand-in Rakuten settings, and the API is answered here.

const ITEM_URL = "https://item.rakuten.co.jp/coffee-beans/blend-500g/";

test("a pasted Ichiba URL fills in the order from the item search API", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00+09:00"));
  const calls: URL[] = [];
  await page.route(RAKUTEN_API, async (route) => {
    calls.push(new URL(route.request().url()));
    await route.fulfill({
      headers: { "Access-Control-Allow-Origin": "*" },
      json: {
        count: 1,
        Items: [
          {
            Item: {
              itemName: "ブレンドコーヒー豆 500g",
              itemCode: "coffee-beans:10000123",
              itemPrice: 2160,
              taxFlag: 0,
              itemUrl: `https://hb.afl.rakuten.co.jp/hgc/x/?pc=${encodeURIComponent(ITEM_URL)}`,
              affiliateUrl: `https://hb.afl.rakuten.co.jp/hgc/x/?pc=${encodeURIComponent(ITEM_URL)}`,
              shopName: "コーヒー豆の店",
              shopCode: "coffee-beans",
              pointRate: 3,
            },
          },
        ],
      },
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "このイベントでプランを作る" }).first().click();
  const form = page.getByRole("region", { name: "注文のリスト" }).locator("form");
  await form.getByRole("textbox", { name: /^商品のURL/ }).fill(ITEM_URL);

  await expect(form.getByRole("textbox", { name: "商品名メモ" })).toHaveValue(
    "ブレンドコーヒー豆 500g",
  );
  await expect(form.getByRole("textbox", { name: "金額（税込）" })).toHaveValue("2160");
  await expect(form.getByRole("textbox", { name: "新しいショップの名前" })).toHaveValue(
    "コーヒー豆の店",
  );
  await expect(form.getByRole("textbox", { name: "ショップ独自倍率" })).toHaveValue("3");
  expect(calls).toHaveLength(1);
  expect(calls[0]?.origin + (calls[0]?.pathname ?? "")).toBe(
    "https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701",
  );
  expect(Object.fromEntries(calls[0]?.searchParams ?? [])).toMatchObject({
    applicationId: "e2e-application-id",
    accessKey: "e2e-access-key",
    shopCode: "coffee-beans",
    keyword: "blend-500g",
  });

  await form.getByRole("button", { name: "追加する" }).click();
  await expect(
    page.getByRole("region", { name: "注文のリスト" }).getByText("コーヒー豆の店").first(),
  ).toBeVisible();
});

test("a failed lookup leaves the shop of the URL and says so", async ({ page }) => {
  await page.route(RAKUTEN_API, (route) =>
    route.fulfill({
      status: 429,
      headers: { "Access-Control-Allow-Origin": "*" },
      json: { error: "too_many_requests", error_description: "Rate limit is exceeded" },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "このイベントでプランを作る" }).first().click();
  const form = page.getByRole("region", { name: "注文のリスト" }).locator("form");
  await form.getByRole("textbox", { name: /^商品のURL/ }).fill(ITEM_URL);

  await expect(form.getByText(/^自動入力できませんでした/)).toBeVisible();
  await expect(form.getByRole("textbox", { name: "新しいショップの名前" })).toHaveValue(
    "coffee-beans",
  );
  await expect(form.getByRole("textbox", { name: "金額（税込）" })).toHaveValue("");
});
