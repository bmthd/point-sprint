import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { createMemoryRepository } from "../../storage/memory-repository";
import { PLAN, marathon, marathonPlan, order, renderPlanHome, shops } from "./-test-fixtures";

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
  await expect.element(screen.getByText("読み込めなかったデータが2件あります。")).toBeVisible();
  expect(screen.getByText("保存データの状態を確認できませんでした。").query()).toBeNull();
});

test("tells that orders on the event's first and last days may be outside it", async () => {
  await page.viewport(1280, 800);
  const plan = {
    ...marathonPlan([
      { ...order(0), date: "2026-10-04" },
      { ...order(1), date: "2026-10-09" },
      order(2),
    ]),
    officialEventId: "marathon-2026-10",
  };
  const event = {
    id: "marathon-2026-10",
    name: "お買い物マラソン",
    period: { start: "2026-10-04", end: "2026-10-09" },
    times: { start: "20:00", end: "01:59" },
    benefits: marathon,
  };
  const repository = createMemoryRepository({ plans: [plan], shops });
  const screen = await renderPlanHome(repository, `/plan?id=${PLAN}`, undefined, [event]);
  await expect
    .element(
      screen.getByText(
        "期間の初日・最終日の注文が2件あります（10/4、10/9）。10/4 20:00 より前、10/9 01:59 より後の注文は対象外ですが、ここでは対象に数えています。",
      ),
    )
    .toBeVisible();

  await renderPlanHome(repository, `/plan?id=${PLAN}`, undefined, [{ ...event, times: undefined }]);
  await expect
    .element(
      page.getByText(
        "期間の初日・最終日の注文が2件あります（10/4、10/9）。時刻によっては対象外ですが、ここでは対象に数えています。",
      ),
    )
    .toBeVisible();
});
