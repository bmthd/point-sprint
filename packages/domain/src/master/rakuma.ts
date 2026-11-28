// 「ラクマ購入 +1倍」（楽天ラクマの「買いまわりラクマ特典」の特典1）。
// 出典: https://rakuma.rakuten.co.jp/info/campaign/buy/kaimawari/ （確認日 2026-11-24）
// お買い物マラソン、楽天スーパーSALE、ブラックフライデーの期間に合わせて開かれ、イベントへのエントリーで
// この特典にもエントリーしたことになる。ラクマで期間中に合計1,000円以上買うと、楽天市場での期間中の購入が
// +1倍になる。対象は1ショップでの合計が1,000円（税込）以上のショップの購入で、税抜・送料別・クーポン適用後の
// 金額にかかる。上限は開催ごとに500ポイントで、2025年6月の回から変わっていない（それまでは1,000ポイント）。
// ラクマでの購入はプランの注文にないので、公式イベントのプランに OFF で置き、ラクマで買った利用者が ON にする。
// 調べた経緯は /guides/rakuma-plus1 にまとめた。
import type { Benefit } from "#/model/benefit.ts";
import type { Id, Period } from "#/model/common.ts";

const SHARED_KEY_PREFIX = "rakuma:";

/** The ラクマ購入 +1倍 of an official event, off until the user says they bought on ラクマ. */
export function rakumaBenefit(event: { id: string; period: Period }, id: Id): Benefit {
  return {
    id,
    kind: "rate-bonus",
    category: "campaign",
    label: "ラクマ購入",
    imagePath: "/img/spu/service_rakuma.webp",
    enabled: false,
    amountBasis: "tax-excluded",
    // The cap is per event, shared by the event's plans.
    capScope: "campaign",
    sharedKey: `${SHARED_KEY_PREFIX}${event.id}`,
    conditions: {
      channels: ["rakuten-ichiba", "rakuten-books", "rakuten-kobo"],
      dateRule: { type: "range", start: event.period.start, end: event.period.end },
      minShopAmount: 1000,
    },
    params: { rate: 1, cap: 500, roundingUnit: "item" },
  };
}

/** Whether the benefit is an official event's ラクマ購入 +1倍. */
export function isRakumaBenefit(benefit: Benefit): boolean {
  return benefit.sharedKey?.startsWith(SHARED_KEY_PREFIX) === true;
}

/**
 * The ラクマ購入 +1倍 of `event` for a plan that had `kept`: the kept one's id and whether it is
 * on, with the event's period and key. A new one, off, when the plan had none.
 */
export function rakumaFor(
  event: { id: string; period: Period },
  kept: Benefit | undefined,
  newId: () => Id,
): Benefit {
  const benefit = rakumaBenefit(event, kept?.id ?? newId());
  return kept ? { ...benefit, enabled: kept.enabled } : benefit;
}
