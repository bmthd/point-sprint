import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { periodOf, readCurrentRound, readSchedule } from "./event-pages";

// The parts of the pages it reads, cut out of them as fetched on 2026-10-17, while the marathon page
// still showed the second round.
const fixture = (name: string) =>
  readFileSync(new URL(`event-pages/${name}`, import.meta.url), "utf8");
const schedule = fixture("schedule-2026-10.html");
const marathon = fixture("marathon-2026-10-14.html");

test("reads the rounds of the month from the schedule page", () => {
  expect(readSchedule(schedule)).toEqual([
    { title: "第一弾", period: { start: "2026-10-04", end: "2026-10-09" } },
    { title: "第二弾", period: { start: "2026-10-14", end: "2026-10-17" } },
    { title: "第三弾", period: { start: "2026-10-24", end: "2026-10-27" } },
  ]);
});

test("reads the round on the marathon page", () => {
  expect(readCurrentRound(marathon)).toEqual({
    campaignName: "お買い物マラソン",
    period: { start: "2026-10-14", end: "2026-10-17" },
    maxRate: 10,
    cap: 7000,
  });
});

test("skips what the pages keep in comments", () => {
  const commented = `<!--<div class="marathonCalender-title"><span>第四弾!</span></div>
    <p class="marathonCalender-lead">2026年10月30日(金) 20:00 ～ 2026年11月2日(月) 09:59</p>-->`;
  expect(readSchedule(commented)).toEqual([]);
});

test("reads no round from a page that shows none", () => {
  expect(readCurrentRound("<p>お買い物マラソンは終了しました</p>")).toBeUndefined();
  expect(readSchedule("<p>お買い物マラソンは終了しました</p>")).toEqual([]);
});

test("reads no round when a fact it needs has changed its form", () => {
  expect(readCurrentRound(marathon.replace("7,000ポイント(期間限定)", "未定"))).toBeUndefined();
  expect(readCurrentRound(marathon.replace("最大10倍まで増加", "最大で10倍"))).toBeUndefined();
  // More at 11 shops than at 10 is not what the tiers can hold.
  expect(
    readCurrentRound(
      marathon.replace("11ショップ以上での購入も10倍", "11ショップ以上での購入は11倍"),
    ),
  ).toBeUndefined();
});

test("reads the days of a period and drops the times", () => {
  expect(periodOf("2026年12月4日(木)20:00～2026年12月11日(木)01:59")).toEqual({
    start: "2026-12-04",
    end: "2026-12-11",
  });
  expect(periodOf("2026年12月4日(木)20:00～")).toBeUndefined();
});
