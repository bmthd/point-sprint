import { expect, test } from "vitest";
import { periodOf } from "./event-pages.ts";

test("reads the days of a period and their times", () => {
  expect(periodOf("2026年12月4日(木)20:00～2026年12月11日(木)1:59")).toEqual({
    period: { start: "2026-12-04", end: "2026-12-11" },
    times: { start: "20:00", end: "01:59" },
  });
  expect(periodOf("2026年12月4日(木)～2026年12月11日(木)01:59")).toEqual({
    period: { start: "2026-12-04", end: "2026-12-11" },
  });
  expect(periodOf("2026年12月4日(木)20:00～")).toBeUndefined();
});
