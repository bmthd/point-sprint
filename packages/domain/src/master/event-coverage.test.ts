import { expect, test } from "vitest";
import type { OfficialEvent } from "../model/official-event";
import { eventMasterRunsOut } from "./event-coverage";

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
