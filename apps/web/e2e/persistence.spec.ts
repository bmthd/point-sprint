import { type Locator, type Page, expect, test } from "./fixtures";

// Each change is saved to IndexedDB and is still there after a reload.

const orderShops = (page: Page) =>
  page
    .getByRole("region", { name: "注文のリスト" })
    .locator("li[data-order-id]")
    .evaluateAll((rows) => rows.map((row) => row.textContent?.match(/店[AB]/)?.[0]));

async function addOrder(page: Page, shop: string) {
  const form = page.getByRole("region", { name: "注文のリスト" }).locator("form");
  await form
    .getByRole("combobox", { name: "ショップ", exact: true })
    .selectOption({ label: "＋ 新しいショップ" });
  await form.getByRole("textbox", { name: "新しいショップの名前" }).fill(shop);
  await form.getByRole("textbox", { name: "金額（税込）" }).fill("3300");
  await form.getByRole("button", { name: "追加する" }).click();
  await expect(page.getByRole("region", { name: "注文のリスト" })).toContainText(shop);
}

const openSettings = async (page: Page) => {
  await page.getByRole("button", { name: /^プランの設定/ }).click();
  const settings = page.getByRole("dialog", { name: "プランの設定" });
  await expect(settings).toBeVisible();
  return settings;
};

/** Taps a checkbox card (an SPU tile, a campaign) on its label: its checkbox is visually hidden. */
const tapCard = (checkbox: Locator) => checkbox.locator("xpath=ancestor::label[1]").click();

test("orders, plan settings, profile and shops survive a reload", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00+09:00"));
  await page.goto("/");
  await page.getByRole("button", { name: "このイベントでプランを作る" }).first().click();
  await expect(page).toHaveURL(/\/plan\?id=/);

  // Order sequence after a reorder.
  await addOrder(page, "店A");
  await addOrder(page, "店B");
  await expect.poll(() => orderShops(page)).toEqual(["店A", "店B"]);
  await page.getByRole("button", { name: "店Bの注文を並べ替え" }).press("ArrowUp");
  await expect.poll(() => orderShops(page)).toEqual(["店B", "店A"]);
  await page.reload();
  await expect.poll(() => orderShops(page)).toEqual(["店B", "店A"]);

  // A plan's SPU tile and campaign toggle.
  const settings = await openSettings(page);
  const tile = settings.getByRole("checkbox", { name: "楽天モバイル +4倍" });
  const campaign = settings
    .getByRole("region", { name: "キャンペーン" })
    .getByRole("switch", { name: /^5と0のつく日/ });
  const tileWas = await tile.isChecked();
  const campaignWas = await campaign.isChecked();
  await tapCard(tile);
  await expect(tile).toBeChecked({ checked: !tileWas });
  await tapCard(campaign);
  await expect(campaign).toBeChecked({ checked: !campaignWas });
  await page.reload();
  await openSettings(page);
  await expect(tile).toBeChecked({ checked: !tileWas });
  await expect(campaign).toBeChecked({ checked: !campaignWas });

  // The profile's SPU default, a shop's name and its 39ショップ mark.
  await page.goto("/profile");
  const defaultTile = page.getByRole("checkbox", { name: "楽天モバイル +4倍" });
  const defaultWas = await defaultTile.isChecked();
  await tapCard(defaultTile);
  await expect(defaultTile).toBeChecked({ checked: !defaultWas });
  const name = page.getByRole("textbox", { name: "店Aの名前" });
  await name.fill("店A本店");
  await name.press("Enter");
  await expect(page.getByRole("textbox", { name: "店A本店の名前" })).toBeVisible();
  const mark = page.getByRole("switch", { name: "店B 39ショップ" });
  // The switch's input is visually hidden: a user clicks its label.
  await page.locator("label").filter({ has: mark }).click();
  await expect(mark).toBeChecked();

  await page.reload();
  await expect(page.getByRole("checkbox", { name: "楽天モバイル +4倍" })).toBeChecked({
    checked: !defaultWas,
  });
  await expect(page.getByRole("textbox", { name: "店A本店の名前" })).toHaveValue("店A本店");
  await expect(page.getByRole("switch", { name: "店B 39ショップ" })).toBeChecked();
});
