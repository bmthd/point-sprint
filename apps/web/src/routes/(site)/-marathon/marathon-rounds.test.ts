import type { OfficialEvent } from "@workspaces/domain";
import { expect, test } from "vitest";
import {
  capReachingSpend,
  longPeriod,
  marathonDescription,
  marathonTitle,
  roundSentence,
  shopAroundOf,
  splitRounds,
} from "./marathon-rounds";

const round = (
  id: string,
  name: string,
  period: { start: string; end: string },
  cap: number | undefined,
): OfficialEvent => ({
  id,
  name,
  period,
  times: { start: "20:00", end: "01:59" },
  benefits: [
    {
      id: `${id}-benefit`,
      kind: "shop-around",
      category: "campaign",
      label: "ショップ買いまわり",
      enabled: true,
      amountBasis: "tax-excluded",
      capScope: "campaign",
      sharedKey: id,
      conditions: { dateRule: { type: "range", ...period } },
      params: {
        tiers: Array.from({ length: 9 }, (_, i) => ({ minShops: i + 2, rate: i + 1 })),
        cap,
        roundingUnit: "item",
      },
    },
  ],
});

const october = round(
  "marathon-2026-10",
  "お買い物マラソン&ジャンル祭",
  { start: "2026-10-04", end: "2026-10-09" },
  7000,
);
const third = round(
  "marathon-2026-10-24",
  "お買い物マラソン第三弾",
  { start: "2026-10-24", end: "2026-10-27" },
  7000,
);
const november = round(
  "marathon-2026-11-04",
  "お買い物マラソン",
  { start: "2026-11-04", end: "2026-11-11" },
  undefined,
);

test("splits the rounds by today: the coming ones first to last, the past ones last to first", () => {
  expect(splitRounds([october, third, november], "2026-10-27")).toEqual({
    ahead: [third, november],
    past: [october],
  });
  expect(splitRounds([october, third, november], "2026-10-28").past).toEqual([third, october]);
});

test("reads the shop-around at its highest tier, and the spend that fills its cap", () => {
  const shopAround = shopAroundOf(third);
  expect(shopAround).toEqual({ maxShops: 10, maxRate: 9, cap: 7000 });
  // The figure the guide on how much to buy gives.
  expect(shopAround && capReachingSpend(shopAround)).toBe(77778);
  expect(capReachingSpend({ maxShops: 10, maxRate: 9, cap: undefined })).toBeUndefined();
});

test("writes the period with its weekdays and times", () => {
  expect(longPeriod(november)).toBe("11月4日（水）20:00〜11月11日（水）1:59");
});

test("names the month of the next round in the title, and the round in the description", () => {
  expect(marathonTitle([november])).toBe("お買い物マラソン 11月の日程と上限");
  expect(marathonTitle([])).toBe("お買い物マラソンの日程と上限");
  expect(marathonDescription([november], "2026-10-29")).toBe(
    "お買い物マラソンは11月4日（水）20:00〜11月11日（水）1:59に開催されます。買いまわりは10ショップで最大10倍、獲得上限はまだ発表されていません。上限に届く金額と、これまでの回の日程・上限も載せています。",
  );
  expect(marathonDescription([], "2026-10-29")).toMatch(
    /^楽天市場のお買い物マラソンの日程と獲得上限。/,
  );
});

test("says a round that has started is running", () => {
  expect(roundSentence(third, "2026-10-25")).toBe(
    "お買い物マラソン第三弾が開催中です。期間は10月24日（土）20:00〜10月27日（火）1:59。買いまわりは10ショップで最大10倍、獲得上限は7,000ポイントです。",
  );
});
