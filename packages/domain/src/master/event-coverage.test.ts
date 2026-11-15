import { expect, test } from "vitest";
import type { OfficialEvent } from "#/model/official-event.ts";
import { eventMasterRunsOut, missingYearlyEvents } from "./event-coverage.ts";

function event(start: string, end: string): OfficialEvent {
  return { id: `event-${start}`, name: "event", period: { start, end }, benefits: [] };
}

test("an event that ends on the horizon keeps the master covered", () => {
  expect(eventMasterRunsOut([event("2026-10-24", "2026-10-27")], "2026-10-20", 7)).toBe(false);
});

test("the master runs out when every event ends before the horizon", () => {
  expect(eventMasterRunsOut([event("2026-10-24", "2026-10-27")], "2026-10-21", 7)).toBe(true);
});

test("the horizon crosses month and year ends", () => {
  expect(eventMasterRunsOut([event("2026-12-30", "2027-01-02")], "2026-12-26", 7)).toBe(false);
  expect(eventMasterRunsOut([event("2026-12-30", "2027-01-02")], "2026-12-27", 7)).toBe(true);
});

test("an empty master has run out", () => {
  expect(eventMasterRunsOut([], "2026-10-09", 7)).toBe(true);
});

const blackFriday = {
  name: "ブラックフライデー",
  idPrefix: "black-friday-",
  due: "11-19",
  until: "11-27",
};

test("a yearly event is missing from its due date while the master lacks this year's", () => {
  const lastYear = { ...event("2025-11-20", "2025-11-27"), id: "black-friday-2025-11-20" };
  expect(missingYearlyEvents([lastYear], [blackFriday], "2026-11-18")).toEqual([]);
  expect(missingYearlyEvents([lastYear], [blackFriday], "2026-11-19")).toEqual([blackFriday]);
  expect(missingYearlyEvents([lastYear], [blackFriday], "2026-11-28")).toEqual([]);
});

test("this year's event in the master is not missing", () => {
  const thisYear = { ...event("2026-11-19", "2026-11-25"), id: "black-friday-2026-11-19" };
  expect(missingYearlyEvents([thisYear], [blackFriday], "2026-11-20")).toEqual([]);
});
