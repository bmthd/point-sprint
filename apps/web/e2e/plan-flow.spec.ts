import { expect, test, fixDate } from "./fixtures";
import { TopPage } from "./pages";

test("create plan, add order, see points, hold it, reload keeps data", async ({ page }) => {
  // The October marathon runs 10/4 to 10/9; the order date defaults to today.
  await fixDate(page, new Date("2026-10-05T12:00:00+09:00"));

  let plan = await (await TopPage.open(page)).createPlan();

  // Desktop: the add accordion at the end of the list.
  await expect(plan.addForm.root).toBeVisible();
  await plan.addForm.newShop("テスト商店");
  await plan.addForm.price.fill("3300");
  await plan.addForm.submit.click();

  await expect(plan.orders.getByText("テスト商店").first()).toBeVisible();
  await expect(plan.breakdown).toContainText("通常30P");
  await expect(plan.summary).toContainText("獲得予定30P");

  await expect(plan.counted("テスト商店")).toBeChecked();
  await plan.toggleCounted("テスト商店");
  await expect(plan.counted("テスト商店")).not.toBeChecked();
  await expect(plan.breakdown).toContainText("通常0P");
  await expect(plan.summary).toContainText("獲得予定0P");
  await expect(plan.struckPoints).toContainText("30P");

  plan = await plan.reload();
  await expect(plan.orders.getByText("テスト商店").first()).toBeVisible();
  await expect(plan.counted("テスト商店")).not.toBeChecked();
  await expect(plan.breakdown).toContainText("通常0P");
  await expect(plan.summary).toContainText("獲得予定0P");
  await expect(plan.struckPoints).toContainText("30P");

  // Counting it again brings the points back, and that survives a reload too.
  await plan.toggleCounted("テスト商店");
  await expect(plan.breakdown).toContainText("通常30P");
  plan = await plan.reload();
  await expect(plan.breakdown).toContainText("通常30P");
  await expect(plan.summary).toContainText("獲得予定30P");
});
