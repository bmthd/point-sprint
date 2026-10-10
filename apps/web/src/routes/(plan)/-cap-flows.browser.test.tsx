import type { Benefit, Plan } from "@workspaces/domain";
import { beforeEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import { createMemoryRepository } from "../../storage/memory-repository";
import { PLAN, baseBenefit, order, renderPlanHome, shops } from "./-test-fixtures";

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

/** The desktop add form with `shop` chosen. */
async function addForm(withPlan = plan, shop = "ショップ0") {
  const screen = await renderPlanHome(createMemoryRepository({ shops, plans: [withPlan] }));
  if (withPlan.orders.length > 0) await screen.getByRole("button", { name: /注文を追加/ }).click();
  // The editor is closed, so the only order fields on the page are the add form's.
  const form = screen.getByRole("region", { name: "注文のリスト" });
  await form.getByRole("combobox", { name: "ショップ", exact: true }).selectOptions(shop);
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

test("an order from a new shop is priced at the rate that shop gives", async () => {
  // +1倍 from 1 shop, +2倍 from 2, at most 300P. The order at ショップ0 earns 100P at +1倍.
  const shopAround: Benefit = {
    id: "b0000000-0000-4000-8000-0000000000c4",
    kind: "shop-around",
    category: "campaign",
    label: "買いまわり",
    enabled: true,
    conditions: {},
    amountBasis: "tax-excluded",
    capScope: "plan",
    params: {
      tiers: [
        { minShops: 1, rate: 1 },
        { minShops: 2, rate: 2 },
      ],
      roundingUnit: "item",
      cap: 300,
    },
  };
  // A period around any day the form's date defaults to, so the new shop counts.
  const withOrder: Plan = {
    ...plan,
    period: { start: "2000-01-01", end: "2099-12-31" },
    benefits: [baseBenefit, shopAround],
    orders: [order(0)],
  };
  const form = await addForm(withOrder, "ショップ1");
  await form.getByRole("textbox", { name: "金額（税込）" }).fill("11000");
  // At +2倍 the first order earns 200P, which leaves 100P: ¥5,000 before tax, ¥5,499 at 10%.
  await expect.poll(flows).toContain("買いまわり（このプラン） +100P・100P はみ出す");
  await expect.element(form.getByRole("button", { name: "¥5,499 で使い切る" })).toBeVisible();
});
