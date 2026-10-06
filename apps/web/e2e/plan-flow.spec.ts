import { expect, test } from "@playwright/test";

test("create plan, add order, see points, hold it, reload keeps data", async ({ page }) => {
  // The October marathon runs 10/4 to 10/9; the order date defaults to today.
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00+09:00"));

  await page.goto("/");
  await page.getByRole("button", { name: "このイベントでプランを作る" }).first().click();
  await expect(page).toHaveURL(/\/plan\?id=/);

  // Desktop: the add accordion at the end of the list.
  const list = page.getByRole("region", { name: "注文のリスト" });
  const form = list.locator("form");
  await expect(form).toBeVisible();
  await form
    .getByRole("combobox", { name: "ショップ", exact: true })
    .selectOption({ label: "＋ 新しいショップ" });
  await form.getByRole("textbox", { name: "新しいショップの名前" }).fill("テスト商店");
  await form.getByRole("textbox", { name: "金額（税込）" }).fill("3300");
  await form.getByRole("button", { name: "追加する" }).click();

  const summary = page.getByRole("region", { name: "サマリー" });
  const breakdown = page.getByRole("list", { name: "ポイントの内訳" });
  await expect(list.getByText("テスト商店").first()).toBeVisible();
  await expect(breakdown).toContainText("通常30P");
  await expect(summary).toContainText("獲得予定30P");

  const count = list.getByRole("checkbox", { name: "テスト商店の注文を買い回りにカウント" });
  await expect(count).toBeChecked();
  // The input itself is visually hidden; a click lands on the box drawn in its label.
  await count.locator("xpath=..").click();
  await expect(count).not.toBeChecked();
  await expect(breakdown).toContainText("通常0P");
  await expect(summary).toContainText("獲得予定0P");
  await expect(list.locator("s")).toContainText("30P");

  await page.reload();
  const reloaded = page.getByRole("region", { name: "注文のリスト" });
  await expect(reloaded.getByText("テスト商店").first()).toBeVisible();
  await expect(
    reloaded.getByRole("checkbox", { name: "テスト商店の注文を買い回りにカウント" }),
  ).not.toBeChecked();
  await expect(page.getByRole("list", { name: "ポイントの内訳" })).toContainText("通常0P");
  await expect(page.getByRole("region", { name: "サマリー" })).toContainText("獲得予定0P");
  await expect(reloaded.locator("s")).toContainText("30P");

  // Counting it again brings the points back, and that survives a reload too.
  await reloaded
    .getByRole("checkbox", { name: "テスト商店の注文を買い回りにカウント" })
    .locator("xpath=..")
    .click();
  await expect(page.getByRole("list", { name: "ポイントの内訳" })).toContainText("通常30P");
  await page.reload();
  await expect(page.getByRole("list", { name: "ポイントの内訳" })).toContainText("通常30P");
  await expect(page.getByRole("region", { name: "サマリー" })).toContainText("獲得予定30P");
});
