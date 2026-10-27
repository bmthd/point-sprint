import { expect, test } from "vitest";
import {
  fixedPercent,
  grouped,
  optionalGrouped,
  percent,
  pointsText,
  rateText,
  rounded,
  yen,
} from "./format";

test("groups numbers without rounding them to two decimal places", () => {
  expect(grouped(1234567)).toBe("1,234,567");
  expect(grouped(1234.5678)).toBe("1,234.568");
  expect(grouped(-1234.5)).toBe("-1,234.5");
  expect(grouped(0)).toBe("0");
  expect(grouped(-0)).toBe("-0");
});

test("leaves missing form values empty", () => {
  expect(optionalGrouped(undefined)).toBe("");
  expect(optionalGrouped(0)).toBe("0");
  expect(optionalGrouped(1234)).toBe("1,234");
});

test("rounds rates to two decimal places and removes trailing zeroes", () => {
  expect(rounded(1234.567)).toBe("1,234.57");
  expect(rounded(1.2)).toBe("1.2");
  expect(rounded(1)).toBe("1");
  expect(rounded(1.005)).toBe("1");
  expect(rounded(-0.001)).toBe("-0");
});

test("adds yen and point units without changing decimal precision", () => {
  expect(yen(1234.567)).toBe("¥1,234.567");
  expect(yen(0)).toBe("¥0");
  expect(pointsText(1234.567)).toBe("1,234.567P");
  expect(pointsText(0)).toBe("0P");
});

test("formats multipliers with the existing optional plus sign", () => {
  expect(rateText(1234.567)).toBe("+1,234.57倍");
  expect(rateText(1.2, false)).toBe("1.2倍");
  expect(rateText(0)).toBe("+0倍");
  expect(rateText(-1)).toBe("+-1倍");
});

test("keeps rounded and fixed decimal percentages distinct", () => {
  expect(percent(1234.567)).toBe("1,234.57%");
  expect(percent(1)).toBe("1%");
  expect(percent(0)).toBe("0%");
  expect(fixedPercent(1234.567)).toBe("1234.6%");
  expect(fixedPercent(1)).toBe("1.0%");
  expect(fixedPercent(0)).toBe("0.0%");
});
