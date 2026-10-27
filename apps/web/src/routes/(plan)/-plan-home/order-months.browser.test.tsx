import { beforeEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import { createMemoryRepository } from "../../../storage/memory-repository";
import { PLAN, makePlan, order, renderPlanHome, shops } from "../-test-fixtures";

beforeEach(async () => {
  await page.viewport(390, 844);
});

test("orders of two months are separated by month, and each month's SPU opens from the plan", async () => {
  const plan = makePlan([], [order(0), { ...order(1), date: "2026-11-02" }, order(2)]);
  const screen = await renderPlanHome(createMemoryRepository({ shops, plans: [plan] }));
  const spu = screen.getByRole("region", { name: "SPU の設定" });
  await expect.element(spu).toMatchTextContent("注文の日付の月で決まります");
  await expect
    .element(spu.getByRole("group", { name: "10月の SPU" }))
    .toMatchTextContent("注文 2件");
  await expect
    .element(spu.getByRole("group", { name: "11月の SPU" }))
    .toMatchTextContent("注文 1件未設定");

  // The list keeps its order: a separator comes before each order of another month than the last.
  const orders = screen.getByRole("list", { name: "注文" });
  await expect.element(orders.getByText("10月の注文")).toHaveLength(2);
  await expect.element(orders.getByText("11月の注文")).toBeVisible();

  await orders.getByRole("button", { name: "11月の SPU 1倍" }).click();
  await expect.poll(() => screen.router.state.location.pathname).toBe("/spu");
  expect(screen.router.state.location.search).toEqual({ month: "2026-11" });
  expect(screen.router.state.location.state.spuFrom).toEqual({ planId: PLAN });
});

test("a plan of one month has one line of SPU and no separators", async () => {
  const plan = makePlan([], [order(0), order(1)]);
  const screen = await renderPlanHome(createMemoryRepository({ shops, plans: [plan] }));
  await expect
    .element(screen.getByRole("region", { name: "SPU の設定" }))
    .toMatchTextContent("SPU（10月）1倍変更");
  expect(screen.getByText("10月の注文").query()).toBeNull();
});
