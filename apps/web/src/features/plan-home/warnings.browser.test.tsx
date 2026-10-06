import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { createMemoryRepository } from "../../storage/memory-repository";
import { marathonPlan, renderPlanHome, shops } from "./test-fixtures";

test("offers a retry when the stored data cannot be checked", async () => {
  await page.viewport(1280, 800);
  const base = createMemoryRepository({ plans: [marathonPlan()], shops });
  let failures = 1;
  const screen = await renderPlanHome({
    ...base,
    quarantined: async () => {
      if (failures-- > 0) throw new Error("unavailable");
      return 2;
    },
  });
  await expect
    .element(screen.getByRole("alert").getByText("保存データの状態を確認できませんでした。"))
    .toBeVisible();
  await screen.getByRole("button", { name: "再試行" }).click();
  await expect
    .element(
      screen.getByText("読み込めなかったデータが2件あります。表示と計算には含めていません。"),
    )
    .toBeVisible();
  expect(screen.getByText("保存データの状態を確認できませんでした。").query()).toBeNull();
});
