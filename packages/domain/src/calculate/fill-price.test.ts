import { describe, expect, test } from "vitest";
import { pointsForPrice, priceToFill } from "./fill-price";

describe("priceToFill", () => {
  test.each([
    // 10,999 yen incl. 10% is 10,000 yen excl. tax (999 yen of tax is rounded down).
    [0.1, 10999],
    [0.08, 10799],
    [0, 10000],
  ] as const)("the smallest tax-included price that earns 100P at +1, tax %s", (taxRate, price) => {
    expect(priceToFill(100, taxRate, 1, "tax-excluded")).toBe(price);
    expect(pointsForPrice(price, taxRate, 1, "tax-excluded")).toBe(100);
    expect(pointsForPrice(price - 1, taxRate, 1, "tax-excluded")).toBe(99);
  });

  test("a tax-included basis counts the price itself", () => {
    expect(priceToFill(100, 0.1, 1, "tax-included")).toBe(10000);
  });

  test("a fractional rate", () => {
    const price = priceToFill(7000, 0.1, 9, "tax-excluded") ?? 0;
    expect(pointsForPrice(price, 0.1, 9, "tax-excluded")).toBe(7000);
    expect(pointsForPrice(price - 1, 0.1, 9, "tax-excluded")).toBeLessThan(7000);
  });

  test("nothing to fill costs nothing; a zero rate never fills", () => {
    expect(priceToFill(0, 0.1, 1, "tax-excluded")).toBe(0);
    expect(priceToFill(100, 0.1, 0, "tax-excluded")).toBeNull();
  });
});
