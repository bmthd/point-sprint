import * as v from "valibot";
import { expect, test } from "vitest";
import { IdSchema, addMonths, closestDateInPeriod, newId } from "./common.ts";

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

test("a new id is 10 lowercase letters and digits", () => {
  expect(newId()).toMatch(/^[0-9a-z]{10}$/);
});

test("new ids differ", () => {
  const ids = new Set(Array.from({ length: 1000 }, newId));
  expect(ids.size).toBe(1000);
});

test.each([
  { name: "a new id", id: "k3x9q2m7za", valid: true },
  { name: "a saved uuid", id: "3f2b8c1e-4d5a-4b6c-9a7d-4e2f1c0b8a9d", valid: true },
  { name: "uppercase letters", id: "K3X9Q2M7ZA", valid: false },
  { name: "the wrong length", id: "k3x9q2m7z", valid: false },
])("$name is an id: $valid", ({ id, valid }) => {
  expect(v.is(IdSchema, id)).toBe(valid);
});
