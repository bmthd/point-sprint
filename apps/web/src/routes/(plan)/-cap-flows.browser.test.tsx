import type { Benefit, Plan } from "@workspaces/domain";
import { beforeEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import { createMemoryRepository } from "../../storage/memory-repository";
import { PLAN, baseBenefit, renderPlanHome, shops } from "./-test-fixtures";

/** +1倍, at most 70P in the plan. */
const campaign: Benefit = {
  id: "b0000000-0000-4000-8000-0000000000c3",
  kind: "rate-bonus",
  category: "campaign",
  label: "エントリーキャンペーン",
  enabled: true,
  conditions: {},
  amountBasis: "tax-excluded",
  capScope: "plan",
  params: { rate: 1, roundingUnit: "item", cap: 70 },
};

const plan: Plan = {
  id: PLAN,
  name: "10月 お買い物マラソン",
  period: { start: "2026-10-04", end: "2026-10-09" },
  benefits: [baseBenefit, campaign],
  orders: [],
  updatedAt: "2026-10-05T00:00:00.000Z",
};

beforeEach(async () => {
  await page.viewport(1280, 900);
});

/** The desktop add form, open while the plan has no orders, with ショップ0 chosen. */
async function addForm() {
  const screen = await renderPlanHome(createMemoryRepository({ shops, plans: [plan] }));
  // The editor is closed, so the only order fields on the page are the add form's.
  const form = screen.getByRole("region", { name: "注文のリスト" });
  await form.getByRole("combobox", { name: "ショップ", exact: true }).selectOptions("ショップ0");
  return form;
}

const flows = () =>
  document.querySelector<HTMLElement>('ul[aria-label="上限への入り方"]')?.textContent ?? "";

test("the amount typed shows where its points go, and a button fills the cap", async () => {
  const form = await addForm();
  const amount = form.getByRole("textbox", { name: "金額（税込）" });
  // ¥11,000 at 10% → ¥10,000 before tax → 100P, 30P more than the 70P cap.
  await amount.fill("11000");
  await expect.poll(flows).toContain("エントリーキャンペーン（このプラン） +70P・30P はみ出す");
  await form.getByRole("button", { name: "¥7,699 で使い切る" }).click();
  await expect.element(amount).toHaveValue("7699");
  await expect.poll(flows).toContain("+70P");
  expect(flows()).not.toContain("はみ出す");
});

test("nothing is shown until an amount is typed", async () => {
  await addForm();
  await expect.poll(() => document.querySelector("[data-preview]")).not.toBeNull();
  expect(document.querySelector('ul[aria-label="上限への入り方"]')).toBeNull();
});
