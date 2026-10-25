import { expect, test } from "vitest";
import { addMonths, closestDateInPeriod } from "./common";

test.each([
  {
    name: "uses the first day when today is before the period",
    date: "2026-10-03",
    period: { start: "2026-10-04", end: "2026-10-09" },
    expected: "2026-10-04",
  },
  {
    name: "uses today when today is within the period",
    date: "2026-10-05",
    period: { start: "2026-10-04", end: "2026-10-09" },
    expected: "2026-10-05",
  },
  {
    name: "uses the last day when today is after the period",
    date: "2026-10-10",
    period: { start: "2026-10-04", end: "2026-10-09" },
    expected: "2026-10-09",
  },
])("$name", ({ date, period, expected }) => {
  expect(closestDateInPeriod({ date, period })).toBe(expected);
});

test.each([
  { month: "2026-10", count: 1, expected: "2026-11" },
  { month: "2026-12", count: 1, expected: "2027-01" },
  { month: "2026-01", count: -1, expected: "2025-12" },
  { month: "2026-10", count: -14, expected: "2025-08" },
])("addMonths($month, $count) is $expected", ({ month, count, expected }) => {
  expect(addMonths(month, count)).toBe(expected);
});
