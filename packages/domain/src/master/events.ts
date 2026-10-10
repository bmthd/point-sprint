// 公式イベントのマスタデータ。出典と確認日はイベントごとに書く。
// 更新の手順は docs/event-master.md。
import type { OfficialEvent } from "../model/official-event";

// 出典: https://event.rakuten.co.jp/campaign/point-up/marathon/guide/
// 確認日: 2026-10-09
// 「最大は10ショップ購入時のポイント10倍です（通常ポイント1倍＋期間限定ポイント9倍）」
// 「※11ショップ以上でのお買い物も、最大10倍(通常ポイント1倍＋特典ポイント9倍)となります。」
// 開催回のページが公開される前のマラソンに使う。公開されたら、そのページの表記で確かめ直す。
const marathonTiers = [
  { minShops: 2, rate: 1 },
  { minShops: 3, rate: 2 },
  { minShops: 4, rate: 3 },
  { minShops: 5, rate: 4 },
  { minShops: 6, rate: 5 },
  { minShops: 7, rate: 6 },
  { minShops: 8, rate: 7 },
  { minShops: 9, rate: 8 },
  { minShops: 10, rate: 9 },
];

export const officialEvents: OfficialEvent[] = [
  // 出典: https://event.rakuten.co.jp/campaign/point-up/marathon/
  // 確認日: 2026-10-04
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
  // 出典: https://event.rakuten.co.jp/campaign/point-up/marathon/schedule/
  // 確認日: 2026-10-09
  // 10月のスケジュールのページ。開催回のページはまだない。スケジュールのページは 2026-10-12 10:00 から
  // 開催回のページへのボタンを出すので、そのころ公開されるとみられる。
  {
    id: "marathon-2026-10-14",
    // ページの表記「第二弾!」。
    name: "お買い物マラソン第二弾",
    // 「2026年10月14日(水) 20:00 ～ 2026年10月17日(土) 09:59」。時刻は表せないため日付だけ写す。
    period: { start: "2026-10-14", end: "2026-10-17" },
    benefits: [
      {
        id: "fc7a45a2-5bd9-49ee-a9e7-6104109bd30d",
        kind: "shop-around",
        category: "campaign",
        label: "ショップ買いまわり",
        enabled: true,
        amountBasis: "tax-excluded",
        capScope: "campaign",
        sharedKey: "marathon-2026-10-14",
        conditions: { dateRule: { type: "range", start: "2026-10-14", end: "2026-10-17" } },
        params: {
          tiers: marathonTiers,
          // ページの HTML にある「お買い物マラソン第二弾:最大7,000ポイント」。この行は画面に出ない
          // （コメントアウトされている）ため、開催回のページで確かめ直す。
          cap: 7000,
          roundingUnit: "item",
        },
      },
    ],
  },
  // 出典: https://event.rakuten.co.jp/campaign/point-up/marathon/schedule/
  // 確認日: 2026-10-09
  // 10月のスケジュールのページ。開催回のページはまだない。スケジュールのページは 2026-10-22 10:00 から
  // 開催回のページへのボタンを出すので、そのころ公開されるとみられる。
  {
    id: "marathon-2026-10-24",
    // ページの表記「第三弾!」。
    name: "お買い物マラソン第三弾",
    // 「2026年10月24日(土) 20:00 ～ 2026年10月27日(火) 09:59」。時刻は表せないため日付だけ写す。
    period: { start: "2026-10-24", end: "2026-10-27" },
    benefits: [
      {
        id: "a34813b7-479d-4081-9a07-6386d48aad50",
        kind: "shop-around",
        category: "campaign",
        label: "ショップ買いまわり",
        enabled: true,
        amountBasis: "tax-excluded",
        capScope: "campaign",
        sharedKey: "marathon-2026-10-24",
        conditions: { dateRule: { type: "range", start: "2026-10-24", end: "2026-10-27" } },
        params: {
          tiers: marathonTiers,
          // ページの HTML にある「お買い物マラソン第三弾:最大7,000ポイント」。この行は画面に出ない
          // （コメントアウトされている）ため、開催回のページで確かめ直す。
          cap: 7000,
          roundingUnit: "item",
        },
      },
    ],
  },
];
