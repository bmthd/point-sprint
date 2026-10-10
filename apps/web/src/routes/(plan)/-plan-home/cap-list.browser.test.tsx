import type { Benefit, Order, Plan } from "@workspaces/domain";
import { beforeEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import { createMemoryRepository } from "../../../storage/memory-repository";
import { PLAN, baseBenefit, renderPlanHome, shopId, shops } from "../-test-fixtures";

const FIRST = "f0000000-0000-4000-8000-0000000000f1";

/** +1倍, at most 100P a month, shared between the plans. */
const card: Benefit = {
  id: "b0000000-0000-4000-8000-0000000000c1",
  kind: "rate-bonus",
  category: "spu",
  label: "楽天カード特典分",
  enabled: true,
  conditions: {},
  amountBasis: "tax-excluded",
  capScope: "month",
  sharedKey: "card",
  params: { rate: 1, roundingUnit: "item", cap: 100 },
};

const order = (unitPrice: number): Order => ({
  id: "01000000-0000-4000-8000-000000000000",
  shopId: shopId(0),
  date: "2026-10-05",
  lineItems: [
    {
      id: "01000000-0000-4000-8000-000000000001",
      name: "商品",
      unitPrice,
      quantity: 1,
      taxRate: 0.1,
      discount: 0,
    },
  ],
  onHold: false,
  tags: [],
});

const plan = (id: string, name: string, start: string, end: string, over: Partial<Plan>): Plan => ({
  id,
  name,
  period: { start, end },
  benefits: [baseBenefit, card],
  orders: [],
  updatedAt: "2026-10-05T00:00:00.000Z",
  ...over,
});

/** 1回目 used `unitPrice` yen of October's card cap; 2回目, the plan shown, has no orders yet. */
const plans = (unitPrice: number, benefits?: Benefit[]) => [
  plan(FIRST, "1回目", "2026-10-04", "2026-10-09", { orders: [order(unitPrice)] }),
  plan(PLAN, "2回目", "2026-10-20", "2026-10-25", benefits ? { benefits } : {}),
];

const caps = () => document.querySelector<HTMLElement>('section[aria-label="上限までの残り"]');
const cardRow = () =>
  Array.from(caps()?.querySelectorAll("li") ?? []).find((row) =>
    row.textContent?.includes("楽天カード特典分"),
  )?.textContent ?? "";

beforeEach(async () => {
  await page.viewport(1280, 900);
});

test("a cap shows what other plans used and the price that fills it", async () => {
  // 1回目: ¥3,300 → ¥3,000 before tax → 30P of October's 100P.
  const screen = await renderPlanHome(createMemoryRepository({ shops, plans: plans(3300) }));
  await expect.poll(cardRow).toContain("10月");
  expect(cardRow()).toContain("1回目と共有");
  expect(cardRow()).toContain("30 / 100P");
  // 70P at +1倍 is ¥7,000 before tax; at 10% the smallest price is ¥7,699.
  expect(cardRow()).toContain("あと¥7,699");
  await screen.getByRole("button", { name: "非課税" }).click();
  await expect.poll(cardRow).toContain("あと¥7,000");
});

test("a cap that is used up says so", async () => {
  // 1回目: ¥11,000 → 100P, the whole cap.
  await renderPlanHome(createMemoryRepository({ shops, plans: plans(11000) }));
  await expect.poll(cardRow).toContain("上限");
  expect(cardRow()).not.toContain("あと¥");
});

test("without a capped benefit there is no list", async () => {
  await renderPlanHome(createMemoryRepository({ shops, plans: plans(3300, [baseBenefit]) }));
  await expect.poll(() => document.querySelector('section[aria-label="サマリー"]')).not.toBeNull();
  expect(caps()).toBeNull();
});
