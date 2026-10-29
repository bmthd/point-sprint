import type { OfficialEvent } from "@workspaces/domain";
import { expect, test } from "vitest";
import { endedLatestFirst, startTarget } from "./start-target";

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

test("chooses when the events are not loaded", () => {
  expect(startTarget(undefined, TODAY)).toEqual({ kind: "choose" });
});

test("chooses when today is unknown", () => {
  expect(startTarget([running], undefined)).toEqual({ kind: "choose" });
});

test("chooses when there are no events", () => {
  expect(startTarget([], TODAY)).toEqual({ kind: "choose" });
});

test("prefers the one running event over an upcoming one", () => {
  expect(startTarget([upcoming, running], TODAY)).toEqual({ kind: "create", event: running });
});

test("chooses when two events are running", () => {
  expect(startTarget([running, runningToo], TODAY)).toEqual({ kind: "choose" });
});

test("uses the one upcoming event when none is running", () => {
  expect(startTarget([latestEnded, upcoming], TODAY)).toEqual({ kind: "create", event: upcoming });
});

test("chooses when two events are upcoming and none is running", () => {
  expect(startTarget([upcoming, upcomingToo], TODAY)).toEqual({ kind: "choose" });
});

test("uses the most recently ended event when only ended ones exist", () => {
  expect(startTarget([earlierEnded, latestEnded], TODAY)).toEqual({
    kind: "create",
    event: latestEnded,
  });
});

test("breaks a tie on the end by the later start, then by the id, in any order", () => {
  const shorter = event("shorter", "2026-09-21", "2026-09-24");
  const sameB = event("same-b", "2026-09-19", "2026-09-24");
  const sameA = event("same-a", "2026-09-19", "2026-09-24");
  const expected = [shorter, sameA, sameB, earlierEnded];
  expect(endedLatestFirst([sameB, earlierEnded, sameA, shorter], TODAY)).toEqual(expected);
  expect(endedLatestFirst([shorter, sameA, earlierEnded, sameB], TODAY)).toEqual(expected);
  expect(startTarget([sameB, sameA, shorter], TODAY)).toEqual({ kind: "create", event: shorter });
  expect(startTarget([sameB, sameA], TODAY)).toEqual({ kind: "create", event: sameA });
});
