import { expect, test } from "./fixtures";
import { FAKE_RAKUTEN_API_PORT, type FakeCall } from "./fake-rakuten-api";
import { TopPage } from "./pages";
import { siteUrl } from "../src/site-url";

// The Worker looks up the item, calling the fake API (e2e/fake-rakuten-api.ts) with the stand-in
// keys `playwright.config.ts` gives `vite preview`. The browser never calls the Rakuten API.

const ITEM_URL = "https://item.rakuten.co.jp/coffee-beans/blend-500g/";

test("a pasted Ichiba URL fills in the order from the Worker's lookup", async ({
  page,
  request,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00+09:00"));
  const browserCalls: string[] = [];
  page.on("request", (sent) => {
    if (new URL(sent.url()).hostname === "openapi.rakuten.co.jp") browserCalls.push(sent.url());
  });

  const plan = await (await TopPage.open(page)).createPlan();
  const form = plan.addForm;
  await form.pasteItemUrl(ITEM_URL);

  await expect(form.itemName).toHaveValue("ブレンドコーヒー豆 500g");
  await expect(form.price).toHaveValue("2160");
  await expect(form.newShopName).toHaveValue("コーヒー豆の店");
  await expect(form.shopRate).toHaveValue("3");

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

  await form.submit.click();
  await expect(plan.orders.getByText("コーヒー豆の店").first()).toBeVisible();
});

test("a typed URL is looked up when the field is left, and a failure says why", async ({
  page,
}) => {
  const plan = await (await TopPage.open(page)).createPlan();
  const form = plan.addForm;
  await form.typeItemUrl("https://item.rakuten.co.jp/coffee-beans/rate-limited/");

  await expect(form.autofillError).toBeVisible();
  await expect(form.newShopName).toHaveValue("coffee-beans");
  await expect(form.price).toHaveValue("");
});
