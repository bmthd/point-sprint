import type { OfficialEvent } from "#/model/official-event.ts";
import { expect, test } from "vitest";
import { endedLatestFirst, startEventChoice } from "./selection.ts";

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

const one = (event: OfficialEvent, ended = false) => ({ kind: "one", event, ended });

test("has nothing to start from when there are no events", () => {
  expect(startEventChoice([], TODAY)).toEqual({ kind: "none" });
});

test("prefers the one running event over an upcoming one", () => {
  expect(startEventChoice([upcoming, running], TODAY)).toEqual(one(running));
});

test("leaves the choice between the running events when two are running", () => {
  expect(startEventChoice([upcoming, running, runningToo], TODAY)).toEqual({
    kind: "many",
    events: [running, runningToo],
  });
});

test("uses the one upcoming event when none is running", () => {
  expect(startEventChoice([latestEnded, upcoming], TODAY)).toEqual(one(upcoming));
});

test("leaves the choice between the upcoming events when two are and none is running", () => {
  expect(startEventChoice([upcoming, upcomingToo], TODAY)).toEqual({
    kind: "many",
    events: [upcoming, upcomingToo],
  });
});

test("uses the most recently ended event, as one that ended, when only ended ones exist", () => {
  expect(startEventChoice([earlierEnded, latestEnded], TODAY)).toEqual(one(latestEnded, true));
});

test("breaks a tie on the end by the later start, then by the id, in any order", () => {
  const shorter = event("shorter", "2026-09-21", "2026-09-24");
  const sameB = event("same-b", "2026-09-19", "2026-09-24");
  const sameA = event("same-a", "2026-09-19", "2026-09-24");
  const expected = [shorter, sameA, sameB, earlierEnded];
  expect(endedLatestFirst([sameB, earlierEnded, sameA, shorter], TODAY)).toEqual(expected);
  expect(endedLatestFirst([shorter, sameA, earlierEnded, sameB], TODAY)).toEqual(expected);
  expect(startEventChoice([sameB, sameA, shorter], TODAY)).toEqual(one(shorter, true));
  expect(startEventChoice([sameB, sameA], TODAY)).toEqual(one(sameA, true));
});

test("the start and end dates both belong to running events", () => {
  const starts = event("starts", TODAY, "2026-10-10");
  const ends = event("ends", "2026-10-01", TODAY);
  expect(startEventChoice([upcoming, starts], TODAY)).toEqual(one(starts));
  expect(startEventChoice([upcoming, ends], TODAY)).toEqual(one(ends));
  expect(startEventChoice([starts, ends], TODAY)).toEqual({ kind: "many", events: [starts, ends] });
  expect(endedLatestFirst([ends, latestEnded], TODAY)).toEqual([latestEnded]);
});

test("selection and sorting leave the source list unchanged", () => {
  const events = [earlierEnded, upcoming, latestEnded];
  const before = structuredClone(events);
  startEventChoice(events, TODAY);
  endedLatestFirst(events, TODAY);
  expect(events).toEqual(before);
});
