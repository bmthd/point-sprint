import { expect, test } from "./fixtures";
import { ProfilePage, TopPage } from "./pages";

// Each change is saved to IndexedDB and is still there after a reload.

test("orders, plan settings, profile and shops survive a reload", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00+09:00"));
  let plan = await (await TopPage.open(page)).createPlan();

  // Order sequence after a reorder.
  await plan.addOrder("店A", "3300");
  await plan.addOrder("店B", "3300");
  await expect.poll(() => plan.orderShops()).toEqual(["店A", "店B"]);
  await plan.moveOrderUp("店B");
  await expect.poll(() => plan.orderShops()).toEqual(["店B", "店A"]);
  plan = await plan.reload();
  await expect.poll(() => plan.orderShops()).toEqual(["店B", "店A"]);

  // A plan's SPU tile and campaign toggle.
  const settings = await plan.openSettings();
  const tile = settings.spuTile("楽天モバイル +4倍");
  const campaign = settings.campaign("5と0のつく日");
  const tileWas = await tile.isChecked();
  const campaignWas = await campaign.isChecked();
  await settings.tap(tile);
  await expect(tile).toBeChecked({ checked: !tileWas });
  await settings.tap(campaign);
  await expect(campaign).toBeChecked({ checked: !campaignWas });
  plan = await plan.reload();
  await plan.openSettings();
  await expect(tile).toBeChecked({ checked: !tileWas });
  await expect(campaign).toBeChecked({ checked: !campaignWas });

  // The profile's SPU default, a shop's name and its 39ショップ mark.
  let profile = await ProfilePage.open(page);
  const defaultTile = profile.spuTile("楽天モバイル +4倍");
  const defaultWas = await defaultTile.isChecked();
  await profile.toggleSpuTile("楽天モバイル +4倍");
  await expect(defaultTile).toBeChecked({ checked: !defaultWas });
  await profile.renameShop("店A", "店A本店");
  await expect(profile.shopName("店A本店")).toBeVisible();
  await profile.toggleShop39("店B");
  await expect(profile.shop39("店B")).toBeChecked();

  profile = await profile.reload();
  await expect(profile.spuTile("楽天モバイル +4倍")).toBeChecked({ checked: !defaultWas });
  await expect(profile.shopName("店A本店")).toHaveValue("店A本店");
  await expect(profile.shop39("店B")).toBeChecked();
});
