import { type OfficialEvent, priceToFill } from "@workspaces/domain";
import { grouped } from "../../../ui/format";
import { monthOf } from "../../../ui/dates";

// What `/marathon` says about the rounds in the event master: the one running or coming, and the
// ones before it. Everything is read from the rounds, so the page changes when collection does.

/** The rounds that have not ended, the earliest first, and the ones that have, the latest first. */
export function splitRounds(rounds: OfficialEvent[], today: string) {
  return {
    ahead: rounds.filter((round) => round.period.end >= today),
    past: rounds
      .filter((round) => round.period.end < today)
      .sort((a, b) => (a.period.start < b.period.start ? 1 : -1)),
  };
}

export type ShopAround = {
  /** The shops at which the rate stops rising. */
  maxShops: number;
  /** The shop-around's own +N倍 there, without the normal 1倍. */
  maxRate: number;
  /** `undefined` while the round's page has not told it. */
  cap: number | undefined;
};

/** A round's shop-around at its highest tier, or `undefined` when it has none. */
export function shopAroundOf(round: OfficialEvent): ShopAround | undefined {
  const benefit = round.benefits.find((b) => b.kind === "shop-around");
  if (benefit?.kind !== "shop-around") return undefined;
  const top = benefit.params.tiers.reduce<(typeof benefit.params.tiers)[number] | undefined>(
    (best, tier) => (best === undefined || tier.rate > best.rate ? tier : best),
    undefined,
  );
  if (top === undefined) return undefined;
  return { maxShops: top.minShops, maxRate: top.rate, cap: benefit.params.cap };
}

/**
 * The tax-excluded spend that fills the cap at the highest rate, rounded as the calculation is
 * (77,778 for 7,000 points at +9倍). `undefined` without a cap.
 */
export function capReachingSpend({ maxRate, cap }: ShopAround): number | undefined {
  if (cap === undefined) return undefined;
  // A tax-exempt item's price is its tax-excluded amount.
  return priceToFill(cap, 0, maxRate, "tax-excluded") ?? undefined;
}

const weekdays = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** `2026-11-04` as `11月4日（水）`. */
export function longDate(date: string): string {
  const [year = 0, month = 0, day = 0] = date.split("-").map(Number);
  const weekday = weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${month}月${day}日（${weekday}）`;
}

/** `11月4日（水）20:00〜11月11日（水）1:59`, without the times when they are not known. */
export function longPeriod(round: OfficialEvent): string {
  const time = (value: string | undefined) => (value ? value.replace(/^0(\d)/, "$1") : "");
  return `${longDate(round.period.start)}${time(round.times?.start)}〜${longDate(round.period.end)}${time(round.times?.end)}`;
}

/** The title of `/marathon`: the month of the round running or coming, when there is one. */
export function marathonTitle(ahead: OfficialEvent[]): string {
  const next = ahead[0];
  return next
    ? `お買い物マラソン ${monthOf(next.period.start)}月の日程と上限`
    : "お買い物マラソンの日程と上限";
}

/** One sentence of the round running or coming: its name, its period, its rate and its cap. */
export function roundSentence(round: OfficialEvent, today: string): string {
  const shopAround = shopAroundOf(round);
  const when =
    round.period.start <= today
      ? `${round.name}が開催中です。期間は${longPeriod(round)}。`
      : `${round.name}は${longPeriod(round)}に開催されます。`;
  const rate =
    shopAround === undefined
      ? ""
      : `買いまわりは${shopAround.maxShops}ショップで最大${shopAround.maxRate + 1}倍、` +
        (shopAround.cap === undefined
          ? "獲得上限はまだ発表されていません。"
          : `獲得上限は${grouped(shopAround.cap)}ポイントです。`);
  return `${when}${rate}`;
}

/** The description of `/marathon`, for search results. */
export function marathonDescription(ahead: OfficialEvent[], today: string): string {
  const next = ahead[0];
  const rest = "上限に届く金額と、これまでの回の日程・上限も載せています。";
  return next
    ? `${roundSentence(next, today)}${rest}`
    : `楽天市場のお買い物マラソンの日程と獲得上限。次の回が告知されると、ここに出ます。${rest}`;
}
