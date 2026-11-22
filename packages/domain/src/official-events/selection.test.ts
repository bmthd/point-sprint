import type { OfficialEvent } from "#/model/official-event.ts";
import { expect, test } from "vitest";
import { endedLatestFirst, selectStartEvent } from "./selection.ts";

const TODAY = "2026-10-05";

function event(id: string, start: string, end: string): OfficialEvent {
  return {
    id,
    name: id,
    period: { start, end },
    url: "https://event.rakuten.co.jp/campaign/point-up/marathon/",
    benefits: [],
  };
}

const running = event("running", "2026-10-04", "2026-10-09");
const runningToo = event("running-too", "2026-10-05", "2026-10-07");
const upcoming = event("upcoming", "2026-11-04", "2026-11-09");
const upcomingToo = event("upcoming-too", "2026-12-04", "2026-12-09");
const latestEnded = event("latest-ended", "2026-09-19", "2026-09-24");
const earlierEnded = event("earlier-ended", "2026-09-04", "2026-09-09");

test("chooses when there are no events", () => {
  expect(selectStartEvent([], TODAY)).toBeUndefined();
});

test("prefers the one running event over an upcoming one", () => {
  expect(selectStartEvent([upcoming, running], TODAY)).toEqual(running);
});

test("chooses when two events are running", () => {
  expect(selectStartEvent([running, runningToo], TODAY)).toBeUndefined();
});

test("uses the one upcoming event when none is running", () => {
  expect(selectStartEvent([latestEnded, upcoming], TODAY)).toEqual(upcoming);
});

test("chooses when two events are upcoming and none is running", () => {
  expect(selectStartEvent([upcoming, upcomingToo], TODAY)).toBeUndefined();
});

test("uses the most recently ended event when only ended ones exist", () => {
  expect(selectStartEvent([earlierEnded, latestEnded], TODAY)).toEqual(latestEnded);
});

test("breaks a tie on the end by the later start, then by the id, in any order", () => {
  const shorter = event("shorter", "2026-09-21", "2026-09-24");
  const sameB = event("same-b", "2026-09-19", "2026-09-24");
  const sameA = event("same-a", "2026-09-19", "2026-09-24");
  const expected = [shorter, sameA, sameB, earlierEnded];
  expect(endedLatestFirst([sameB, earlierEnded, sameA, shorter], TODAY)).toEqual(expected);
  expect(endedLatestFirst([shorter, sameA, earlierEnded, sameB], TODAY)).toEqual(expected);
  expect(selectStartEvent([sameB, sameA, shorter], TODAY)).toEqual(shorter);
  expect(selectStartEvent([sameB, sameA], TODAY)).toEqual(sameA);
});

test("the start and end dates both belong to running events", () => {
  const starts = event("starts", TODAY, "2026-10-10");
  const ends = event("ends", "2026-10-01", TODAY);
  expect(selectStartEvent([upcoming, starts], TODAY)).toEqual(starts);
  expect(selectStartEvent([upcoming, ends], TODAY)).toEqual(ends);
  expect(selectStartEvent([starts, ends], TODAY)).toBeUndefined();
  expect(endedLatestFirst([ends, latestEnded], TODAY)).toEqual([latestEnded]);
});

test("selection and sorting leave the source list unchanged", () => {
  const events = [earlierEnded, upcoming, latestEnded];
  const before = structuredClone(events);
  selectStartEvent(events, TODAY);
  endedLatestFirst(events, TODAY);
  expect(events).toEqual(before);
});
