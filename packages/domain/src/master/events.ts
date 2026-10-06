// 公式イベントのマスタデータ。
// 出典: https://event.rakuten.co.jp/campaign/point-up/marathon/
// 確認日: 2026-10-04
import type { OfficialEvent } from "../model/official-event";

export const officialEvents: OfficialEvent[] = [
  {
    id: "marathon-2026-10",
    // ページの表記「お買い物マラソン&ジャンル祭」。
    name: "お買い物マラソン&ジャンル祭",
    // 「ポイントアップ期間 2026年10月4日(日)20:00～2026年10月9日(金)01:59」。時刻は表せないため日付だけ写す。
    period: { start: "2026-10-04", end: "2026-10-09" },
    benefits: [
      {
        id: "b31ed383-3fb7-425f-9391-70ecc965aa0e",
        kind: "shop-around",
        category: "campaign",
        label: "ショップ買いまわり",
        enabled: true,
        amountBasis: "tax-excluded",
        capScope: "campaign",
        sharedKey: "marathon-2026-10",
        conditions: { dateRule: { type: "range", start: "2026-10-04", end: "2026-10-09" } },
        params: {
          // 「購入ショップ数に応じ、ポイント倍率が2倍、3倍と最大10倍まで増加」「※11ショップ以上での購入も10倍です。」
          // 「特典ポイントは、通常の1倍…分を除いた残りの倍率で付与」なので、2〜10ショップで+1〜+9倍。
          tiers: [
            { minShops: 2, rate: 1 },
            { minShops: 3, rate: 2 },
            { minShops: 4, rate: 3 },
            { minShops: 5, rate: 4 },
            { minShops: 6, rate: 5 },
            { minShops: 7, rate: 6 },
            { minShops: 8, rate: 7 },
            { minShops: 9, rate: 8 },
            { minShops: 10, rate: 9 },
          ],
          // 「獲得上限ポイント数 7,000ポイント(期間限定)」。
          cap: 7000,
          roundingUnit: "item",
        },
      },
      // ページにはラクマ特典（+1倍、上限1,500ポイント、別の達成条件あり）もあるが、
      // 達成条件を conditions で表せないため含めない。0と5のつく日はこのページに記載がない。
    ],
  },
];
