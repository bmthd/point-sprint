import { type OfficialEvent, type Plan } from "@workspaces/domain";
import { expect, test } from "vitest";
import { eventPlanName, startLabel, startTarget } from "./start-target.ts";

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

const plan = (id: string, name: string): Plan => ({
  id,
  name,
  period: { start: "2026-10-01", end: "2026-10-31" },
  benefits: [],
  orders: [],
  updatedAt: "2026-10-01T00:00:00.000Z",
});

const running = event("running", "2026-10-04", "2026-10-09");
const runningToo = event("running-too", "2026-10-05", "2026-10-07");
const upcoming = event("upcoming", "2026-11-04", "2026-11-09");
const latestEnded = event("latest-ended", "2026-09-19", "2026-09-24");

test("leads to the events, with none to choose between, while they are not loaded", () => {
  const target = startTarget(undefined, TODAY, []);
  expect(target).toEqual({ kind: "choose", events: [] });
  expect(startLabel(target)).toBe("計算をはじめる");
});

test("leads to the events, with none to choose between, while today is unknown", () => {
  expect(startTarget([running], undefined, [])).toEqual({ kind: "choose", events: [] });
});

test("leads to the events, with none to choose between, when there are none", () => {
  expect(startTarget([], TODAY, [])).toEqual({ kind: "choose", events: [] });
});

test("starts a plan for the one running event", () => {
  const target = startTarget([upcoming, running], TODAY, []);
  expect(target).toEqual({ kind: "create", event: running, ended: false });
  expect(startLabel(target)).toBe("計算をはじめる");
});

test("leads to the running events to choose between when two are running", () => {
  const target = startTarget([running, runningToo, upcoming], TODAY, []);
  expect(target).toEqual({ kind: "choose", events: [running, runningToo] });
  expect(startLabel(target)).toBe("イベントを選んで計算");
});

test("starts a plan for the latest ended event, saying it is the last one", () => {
  const target = startTarget([latestEnded], TODAY, []);
  expect(target).toEqual({ kind: "create", event: latestEnded, ended: true });
  expect(startLabel(target)).toBe("前回の条件で計算");
});

test("opens the plan already made for the event instead of making another", () => {
  const made = plan("made", eventPlanName(running));
  const target = startTarget([running], TODAY, [plan("other", "9月 other"), made]);
  expect(target).toEqual({ kind: "resume", plan: made });
  expect(startLabel(target)).toBe("続きを計算する");
});

test("opens the plan made for the latest ended event too", () => {
  const made = plan("made", "9月 latest-ended");
  expect(startTarget([latestEnded], TODAY, [made])).toEqual({ kind: "resume", plan: made });
});
