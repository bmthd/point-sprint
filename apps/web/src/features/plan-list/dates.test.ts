import { expect, test } from "vitest";
import {
  formatPeriod,
  monthDayWithWeekday,
  monthOf,
  msUntilTokyoMidnight,
  tokyoToday,
} from "./dates";

test("tokyoToday uses the Japanese calendar day", () => {
  expect(tokyoToday(new Date("2026-09-30T16:00:00Z"))).toBe("2026-10-01");
  expect(tokyoToday(new Date("2026-09-30T14:59:00Z"))).toBe("2026-09-30");
});

test("formats dates for the plan list", () => {
  expect(monthDayWithWeekday("2026-10-04")).toBe("10/4（日）");
  expect(monthOf("2026-10-04")).toBe(10);
  expect(formatPeriod({ start: "2026-10-04", end: "2026-10-09" })).toBe("10/4〜10/9");
  expect(formatPeriod({ start: "2026-10-05", end: "2026-10-05" })).toBe("10/5");
});

test("msUntilTokyoMidnight counts to the next midnight in Japan", () => {
  expect(msUntilTokyoMidnight(new Date("2026-10-05T14:59:00Z"))).toBe(60_000);
  // At midnight itself, the next one is a whole day away.
  expect(msUntilTokyoMidnight(new Date("2026-10-05T15:00:00Z"))).toBe(24 * 60 * 60 * 1000);
});
