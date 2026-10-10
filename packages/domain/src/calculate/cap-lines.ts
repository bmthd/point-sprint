import { tierRate } from "../benefit-kinds/shop-around";
import type { Benefit } from "../model/benefit";
import { type Plan, planAccountId } from "../model/plan";
import { capGroupKey } from "./cap-groups";
import type { CalculationResult } from "./types";

/** One cap of one benefit of a plan: how much of it is used, and what is left. */
export type CapLine = {
  benefit: Benefit;
  /** The cap group's key (`capGroupKey`). */
  key: string;
  scope: Benefit["capScope"];
  /** `YYYY-MM` for a month cap, `YYYY-MM-DD` for a day cap, otherwise `null`. */
  period: string | null;
  cap: number;
  /** Points this plan received from the cap. */
  usedHere: number;
  /** Points the other plans of the account received from the cap. */
  usedElsewhere: number;
  /** IDs of the other plans that received points from the cap. */
  sharedWith: string[];
  /** Raw points of every member of the cap group, before the cap. */
  raw: number;
  /** Points the cap can still give: the cap minus the raw points of every member. */
  remaining: number;
  /** +N倍 one more yen earns; a shop-around benefit's rate at the plan's shop count. */
  rate: number;
};

/** `YYYY-MM` of every month the period touches. */
function monthsOf(period: Plan["period"]): string[] {
  const months: string[] = [];
  let year = Number(period.start.slice(0, 4));
  let month = Number(period.start.slice(5, 7));
  const last = period.end.slice(0, 7);
  for (;;) {
    const current = `${year}-${String(month).padStart(2, "0")}`;
    months.push(current);
    if (current >= last) return months;
    month += 1;
    if (month > 12) {
      year += 1;
      month = 1;
    }
  }
}

/** The dates whose groups a benefit's lines show, and each line's `period`. */
function datesOf(
  benefit: Benefit,
  plan: Plan,
  day: string,
): { date: string; period: string | null }[] {
  switch (benefit.capScope) {
    case "plan":
    case "campaign":
      return [{ date: plan.period.start, period: null }];
    case "month":
      return monthsOf(plan.period).map((month) => ({ date: `${month}-01`, period: month }));
    case "day":
      return [{ date: day, period: day }];
  }
}

function rateOf(benefit: Benefit, shopCount: number): number {
  switch (benefit.kind) {
    case "rate-bonus":
      return benefit.params.rate;
    case "shop-around":
      return tierRate(benefit.params.tiers, shopCount);
  }
}

/**
 * The caps of the plan's enabled benefits that have one, with how much of each is used. Month caps
 * have a line for each month of the period; a day cap is `day`'s when it is in the period, and
 * otherwise the first day's. `plan` must have the account it was calculated with.
 */
export function capLines(
  plan: Plan,
  result: Pick<CalculationResult, "capUsage" | "shopCount">,
  day: string | undefined,
): CapLine[] {
  const { start, end } = plan.period;
  const capDay = day !== undefined && day >= start && day <= end ? day : start;
  const owner = { id: plan.id, accountId: planAccountId(plan) };
  return plan.benefits
    .filter((benefit) => benefit.enabled)
    .flatMap((benefit) =>
      datesOf(benefit, plan, capDay).flatMap(({ date, period }): CapLine[] => {
        const key = capGroupKey(owner, benefit, date);
        const usage = result.capUsage[key];
        const caps = [usage?.cap, benefit.params.cap].filter((cap) => cap !== undefined);
        if (caps.length === 0) return [];
        const cap = Math.min(...caps);
        const points = usage?.points ?? {};
        const others = Object.entries(points).filter(([id, used]) => id !== plan.id && used > 0);
        return [
          {
            benefit,
            key,
            scope: benefit.capScope,
            period,
            cap,
            usedHere: points[plan.id] ?? 0,
            usedElsewhere: others.reduce((sum, [, used]) => sum + used, 0),
            sharedWith: others.map(([id]) => id),
            raw: usage?.raw ?? 0,
            remaining: Math.max(0, cap - (usage?.raw ?? 0)),
            rate: rateOf(benefit, result.shopCount),
          },
        ];
      }),
    );
}
