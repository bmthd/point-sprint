import type { Benefit } from "../model/benefit";
import { monthsOf } from "../model/common";
import { type Plan, planAccountId } from "../model/plan";
import { capGroupKey } from "./cap-groups";
import type { CalculationResult } from "./types";

/** One cap of one benefit of a plan: how much of it is used, and what is left. */
export type CapLine = {
  benefit: Benefit;
  /** The cap group's key (`capGroupKey`). */
  key: string;
  scope: Benefit["capScope"];
  /**
   * `YYYY-MM` for a month cap, `YYYY-MM-DD` for the first day of an occurrence cap, otherwise
   * `null`.
   */
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
  /** +N倍 one more yen earns: the benefit's rate in the calculation (`CalculationResult.rates`). */
  rate: number;
};

/** The dates whose groups a benefit's lines show, and each line's `period`. */
function datesOf(benefit: Benefit, plan: Plan): { date: string; period: string | null }[] {
  switch (benefit.capScope) {
    case "plan":
    case "campaign":
      return [{ date: plan.period.start, period: null }];
    case "month":
      return monthsOf(plan.period)
        .filter((month) => benefit.conditions.months?.includes(month) ?? true)
        .map((month) => ({ date: `${month}-01`, period: month }));
    case "occurrence":
      return [{ date: plan.period.start, period: firstDayOf(benefit) }];
  }
}

/** The first day a benefit is for, when its days are set. */
function firstDayOf(benefit: Benefit): string | null {
  const rule = benefit.conditions.dateRule;
  switch (rule?.type) {
    case "dates":
      return [...rule.dates].sort()[0] ?? null;
    case "range":
      return rule.start;
    default:
      return null;
  }
}

/**
 * The caps of the plan's enabled benefits that have one, with how much of each is used. Month caps
 * have a line for each month of the period. `plan` must have the account it was calculated with.
 */
export function capLines(
  plan: Plan,
  result: Pick<CalculationResult, "capUsage" | "rates">,
): CapLine[] {
  const owner = { id: plan.id, accountId: planAccountId(plan) };
  return plan.benefits
    .filter((benefit) => benefit.enabled)
    .flatMap((benefit) =>
      datesOf(benefit, plan).flatMap(({ date, period }): CapLine[] => {
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
            rate: result.rates[benefit.id] ?? 0,
          },
        ];
      }),
    );
}
