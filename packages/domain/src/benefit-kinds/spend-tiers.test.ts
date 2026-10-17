import * as v from "valibot";
import { expect, test } from "vitest";
import { spendTierRate, spendTiers } from "./spend-tiers";

const tiers = [
  { minAmount: 5000, rate: 1 },
  { minAmount: 10000, rate: 2 },
  { minAmount: 20000, rate: 3 },
];
const items = [{ lineItemId: "a", orderId: "o1", amount: 10000 }];
const run = (spendTotal: number) =>
  spendTiers.rawPoints({
    params: { tiers, roundingUnit: "item" },
    items,
    shopCount: 0,
    spendTotal,
  });

test.each([
  { spendTotal: 4999, rate: 0 },
  { spendTotal: 5000, rate: 1 },
  { spendTotal: 19999, rate: 2 },
  { spendTotal: 20000, rate: 3 },
  { spendTotal: 100000, rate: 3 },
])("a total of $spendTotal yen gives +$rate", ({ spendTotal, rate }) => {
  expect(spendTierRate(tiers, spendTotal)).toBe(rate);
  expect(run(spendTotal).get("a")).toBe(rate * 100);
});

test("tiers out of order give the highest one reached", () => {
  expect(spendTierRate([...tiers].reverse(), 12000)).toBe(2);
});

test("params need at least one tier", () => {
  expect(v.safeParse(spendTiers.paramsSchema, { tiers: [] }).success).toBe(false);
});
