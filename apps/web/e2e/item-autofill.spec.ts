import { type Page, expect, test } from "./fixtures";
import { FAKE_RAKUTEN_API_PORT, type FakeCall } from "./fake-rakuten-api";
import { siteUrl } from "../src/site-url";

// The Worker looks up the item, calling the fake API (e2e/fake-rakuten-api.ts) with the stand-in
// keys `playwright.config.ts` gives `vite preview`. The browser never calls the Rakuten API.

const ITEM_URL = "https://item.rakuten.co.jp/coffee-beans/blend-500g/";

/** Pastes `text` into the focused field from the clipboard. */
async function paste(page: Page, text: string) {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
  await page.keyboard.press("ControlOrMeta+V");
}

async function openAddForm(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "このイベントでプランを作る" }).first().click();
  return page.getByRole("region", { name: "注文のリスト" }).locator("form");
}

test("a pasted Ichiba URL fills in the order from the Worker's lookup", async ({
  page,
  request,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00+09:00"));
  const browserCalls: string[] = [];
  page.on("request", (sent) => {
    if (new URL(sent.url()).hostname === "openapi.rakuten.co.jp") browserCalls.push(sent.url());
  });

  const form = await openAddForm(page);
  await form.getByRole("textbox", { name: /^商品のURL/ }).focus();
  await paste(page, ITEM_URL);

  await expect(form.getByRole("textbox", { name: "商品名メモ" })).toHaveValue(
    "ブレンドコーヒー豆 500g",
  );
  await expect(form.getByRole("textbox", { name: "金額（税込）" })).toHaveValue("2160");
  await expect(form.getByRole("textbox", { name: "新しいショップの名前" })).toHaveValue(
    "コーヒー豆の店",
  );
  await expect(form.getByRole("textbox", { name: "ショップ独自倍率" })).toHaveValue("3");

  const calls: FakeCall[] = await (
    await request.get(`http://127.0.0.1:${FAKE_RAKUTEN_API_PORT}/calls`)
  ).json();
  const ours = calls.filter((call) => call.params.keyword === "blend-500g");
  expect(ours).toHaveLength(1);
  expect(ours[0]?.params).toMatchObject({
    applicationId: "e2e-application-id",
    accessKey: "e2e-access-key",
    affiliateId: "e2e-affiliate-id",
    shopCode: "coffee-beans",
  });
  expect(ours[0]?.origin).toBe(siteUrl);
  expect(browserCalls).toEqual([]);

  await form.getByRole("button", { name: "追加する" }).click();
  await expect(
    page.getByRole("region", { name: "注文のリスト" }).getByText("コーヒー豆の店").first(),
  ).toBeVisible();
});

test("a typed URL is looked up when the field is left, and a failure says why", async ({
  page,
}) => {
  const form = await openAddForm(page);
  const url = form.getByRole("textbox", { name: /^商品のURL/ });
  await url.fill("https://item.rakuten.co.jp/coffee-beans/rate-limited/");
  await url.blur();

  await expect(form.getByText(/^自動入力できませんでした/)).toBeVisible();
  await expect(form.getByRole("textbox", { name: "新しいショップの名前" })).toHaveValue(
    "coffee-beans",
  );
  await expect(form.getByRole("textbox", { name: "金額（税込）" })).toHaveValue("");
});
