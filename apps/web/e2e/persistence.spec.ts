import { expect, test, fixDate } from "./fixtures";
import { ProfilePage, TopPage } from "./pages";

// Each change is saved to IndexedDB and is still there after a reload.

test("orders, plan settings, profile and shops survive a reload", async ({ page }) => {
  await fixDate(page, new Date("2026-10-05T12:00:00+09:00"));
  let plan = await (await TopPage.open(page)).createPlan();

  // Order sequence after a reorder.
  await plan.addOrder("店A", "3300");
  await plan.addOrder("店B", "3300");
  await expect.poll(() => plan.orderShops()).toEqual(["店A", "店B"]);
  await plan.moveOrderUp("店B");
  await expect.poll(() => plan.orderShops()).toEqual(["店B", "店A"]);
  plan = await plan.reload();
  await expect.poll(() => plan.orderShops()).toEqual(["店B", "店A"]);

  // An SPU tile, which is the month's, and a plan's campaign toggle.
  const spu = await plan.openSpu("10月");
  const tile = spu.spuTile("楽天モバイル +4倍");
  await expect(tile).not.toBeChecked();
  await spu.tap(tile);
  await expect(tile).toBeChecked();
  await spu.close();
  await expect(plan.spuRate("10月")).toHaveText("5倍");
  const settings = await plan.openSettings();
  const campaign = settings.campaign("5と0のつく日");
  const campaignWas = await campaign.isChecked();
  await settings.tap(campaign);
  await expect(campaign).toBeChecked({ checked: !campaignWas });
  plan = await plan.reload();
  await expect(plan.spuRate("10月")).toHaveText("5倍");
  await plan.openSettings();
  await expect(campaign).toBeChecked({ checked: !campaignWas });

  // A shop's name and its 39ショップ mark.
  let profile = await ProfilePage.open(page);
  await profile.renameShop("店A", "店A本店");
  await expect(profile.shopName("店A本店")).toBeVisible();
  await profile.toggleShop39("店B");
  await expect(profile.shop39("店B")).toBeChecked();

  profile = await profile.reload();
  await expect(profile.shopName("店A本店")).toHaveValue("店A本店");
  await expect(profile.shop39("店B")).toBeChecked();
});
