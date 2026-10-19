/** Which of a campaign's values the user sets, beside its days. */
export type FormSpec = {
  /** One date and a +1 / +2 choice (a team that won, or both). */
  date?: boolean;
  /** A +1 / +2 / +3 choice by the member's rank (ゴールド, プラチナ, ダイヤモンド). */
  rank?: boolean;
  period?: boolean;
  rate?: boolean;
  cap?: "optional" | "required";
  minOrderAmount?: boolean;
  label?: boolean;
};

export const SPECS: Record<string, FormSpec> = {
  "thanks-day": { rank: true },
  "sports-win": { date: true },
  "39shop": { period: true },
  repeat: { period: true, minOrderAmount: true, cap: "required" },
  "shop-around-manual": { period: true, cap: "required" },
  pointback: { period: true },
  "spend-tiers-manual": { period: true, cap: "required" },
  "custom-rate": { label: true, period: true, rate: true, cap: "optional" },
};

/**
 * The cap a campaign is added with when its template has none and it needs one: a value to
 * start from, changed afterwards to the one of the event.
 */
export const PLACEHOLDER_CAP = 1000;
