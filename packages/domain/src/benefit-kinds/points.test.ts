import { expect, test } from "vitest";
import { pointsFor } from "./points";

const item = (lineItemId: string, orderId: string, amount: number) => ({
  lineItemId,
  orderId,
  amount,
});

test("+1 per item: 3,000 yen yields 30", () => {
  expect(pointsFor([item("a", "o1", 3000)], 1, "item").get("a")).toBe(30);
});

test("+0.5 per item floors per item", () => {
  const result = pointsFor([item("a", "o1", 199), item("b", "o1", 199)], 0.5, "item");
  expect([result.get("a"), result.get("b")]).toEqual([0, 0]);
});

test("+0.5 per order sums before flooring", () => {
  const result = pointsFor([item("a", "o1", 199), item("b", "o1", 199)], 0.5, "order");
  expect([result.get("a"), result.get("b")]).toEqual([1, 0]);
});

test("fractional rate does not suffer float error", () => {
  expect(pointsFor([item("a", "o1", 1000)], 0.1, "item").get("a")).toBe(1);
});
