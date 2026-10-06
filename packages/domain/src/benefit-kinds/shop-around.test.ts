import { expect, test } from "vitest";
import { shopAround } from "./shop-around";

const tiers = [
  { minShops: 2, rate: 1 },
  { minShops: 3, rate: 2 },
  { minShops: 4, rate: 3 },
  { minShops: 5, rate: 4 },
  { minShops: 6, rate: 5 },
  { minShops: 7, rate: 6 },
  { minShops: 8, rate: 7 },
  { minShops: 9, rate: 8 },
  { minShops: 10, rate: 9 },
];
const items = [{ lineItemId: "a", orderId: "o1", amount: 10000 }];
const run = (shopCount: number) =>
  shopAround.rawPoints({ params: { tiers, roundingUnit: "item" }, items, shopCount });

test("one shop gives no bonus", () => {
  expect(run(1).get("a")).toBe(0);
});

test("ten shops give +9", () => {
  expect(run(10).get("a")).toBe(900);
});

test("eleven shops stay at +9", () => {
  expect(run(11).get("a")).toBe(900);
});
