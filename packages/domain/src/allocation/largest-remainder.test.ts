import { describe, expect, test } from "vitest";
import { largestRemainder } from "./largest-remainder";

describe("largestRemainder", () => {
  test("splits 10 by 1:1:1 as 4,3,3", () => {
    expect(largestRemainder(10, [1, 1, 1])).toEqual([4, 3, 3]);
  });
  test("keeps the sum for uneven weights", () => {
    expect(largestRemainder(7, [1800, 1200])).toEqual([4, 3]);
  });
  test("all-zero weights are treated as equal", () => {
    expect(largestRemainder(3, [0, 0])).toEqual([2, 1]);
  });
  test("empty weights", () => {
    expect(largestRemainder(0, [])).toEqual([]);
  });
});
