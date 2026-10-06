import { describe, expect, test } from "vitest";
import type { LineItem } from "../model/order";
import { taxExcludedTarget, taxIncludedTarget } from "./target-amount";

const item = (over: Partial<LineItem>): LineItem => ({
  id: "3f2b8c1e-5d4a-4e7b-9a10-1c2d3e4f5a6b",
  name: "item",
  unitPrice: 0,
  quantity: 1,
  taxRate: 0.1,
  discount: 0,
  ...over,
});

describe("target amounts", () => {
  test("tax-excluded 1,980 yen at 10% is 1,800", () => {
    expect(taxExcludedTarget(item({ unitPrice: 1980 }))).toBe(1800);
  });
  test("tax-excluded 1,080 yen at 8% is 1,000", () => {
    expect(taxExcludedTarget(item({ unitPrice: 1080, taxRate: 0.08 }))).toBe(1000);
  });
  test("applies discount before tax extraction", () => {
    const i = item({ unitPrice: 1100, quantity: 2, discount: 200 });
    expect(taxIncludedTarget(i)).toBe(2000);
    expect(taxExcludedTarget(i)).toBe(1819);
  });
  test("tax-exempt item has equal included and excluded targets", () => {
    const i = item({ unitPrice: 1000, taxRate: 0 });
    expect(taxIncludedTarget(i)).toBe(1000);
    expect(taxExcludedTarget(i)).toBe(1000);
  });
  test("zero-price item yields zero", () => {
    expect(taxIncludedTarget(item({}))).toBe(0);
    expect(taxExcludedTarget(item({}))).toBe(0);
  });
});
