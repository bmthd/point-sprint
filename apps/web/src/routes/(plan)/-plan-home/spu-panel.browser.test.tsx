import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { createMemoryRepository } from "#/storage/memory-repository.ts";
import { PLAN, makePlan, order, renderPlanHome, shops } from "#/routes/(plan)/-test-fixtures.tsx";

test("on a desktop a month's SPU, switched to another month and opened again with the forward button, closes back to the plan", async () => {
  await page.viewport(1280, 900);
  const plan = makePlan([], [order(0), { ...order(1), date: "2026-11-02" }]);
  const screen = await renderPlanHome(createMemoryRepository({ shops, plans: [plan] }));
  await screen
    .getByRole("region", { name: "SPU の設定" })
    .getByRole("button", { name: "10月の SPU を変更" })
    .click();
  const panel = screen.getByRole("dialog", { name: /の SPU$/ });
  await expect.element(panel).toBeVisible();
  // Another month replaces the one shown, and closing still goes back to the plan.
  // The segment's radio is visually hidden under its label, so the label is clicked.
  await panel
    .getByRole("radiogroup", { name: "SPU の月" })
    .getByRole("radio")
    .nth(1)
    .element()
    .closest("label")
    ?.click();
  await expect
    .poll(() => screen.router.state.location.search)
    .toEqual({ id: PLAN, spu: "2026-11" });

  screen.router.history.back();
  await expect.element(panel).not.toBeInTheDocument();
  screen.router.history.forward();
  await expect.element(panel).toBeVisible();

  await panel.getByRole("button", { name: "計算に戻る" }).click();
  await expect.element(panel).not.toBeInTheDocument();
  expect(screen.router.state.location.search).toEqual({ id: PLAN });
  // Back on the plan's own entry, not a copy of it left after the panel's entry.
  expect(screen.router.history.canGoBack()).toBe(false);
});
