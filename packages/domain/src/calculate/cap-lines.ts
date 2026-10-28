import { pointsFor } from "../benefit-kinds";
import { spendTierRate } from "../benefit-kinds/spend-tiers";
import { inDateRule } from "../conditions/matches";
import type { Benefit } from "../model/benefit";
import { daysOf, monthsOf } from "../model/common";
import { type Plan, planAccountId } from "../model/plan";
import { capGroupKey } from "./cap-groups";
import { pointsForPrice, priceToFill, type TaxRate } from "./fill-price";
import type { CalculationResult, EligibleLineItem } from "./types";

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
  /** The plan's items in the cap. A spend-tiers' tier sets what they earn. */
  items: EligibleLineItem[];
  /** A spend-tiers' tax-included total over its days (`CalculationResult.spendTotals`), else 0. */
  spendTotal: number;
};

/**
 * The dates whose groups a benefit's lines show, and each line's `period`. A month or an occurrence
 * none of whose days are in the period has no line, as its cap cannot be filled.
 */
function datesOf(benefit: Benefit, plan: Plan): { date: string; period: string | null }[] {
  const { dateRule, months } = benefit.conditions;
  const days = daysOf(plan.period).filter(
    (day) =>
      (dateRule === undefined || inDateRule(dateRule, day)) &&
      (months?.includes(day.slice(0, 7)) ?? true),
  );
  switch (benefit.capScope) {
    case "plan":
    case "campaign":
      return [{ date: plan.period.start, period: null }];
    case "month":
      return monthsOf(plan.period)
        .filter((month) => days.some((day) => day.startsWith(month)))
        .map((month) => ({ date: `${month}-01`, period: month }));
    case "occurrence":
      return days.length === 0 ? [] : [{ date: plan.period.start, period: firstDayOf(benefit) }];
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
  result: Pick<CalculationResult, "capUsage" | "rates" | "spendTotals" | "eligibleItems">,
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
            items: (result.eligibleItems[benefit.id] ?? []).filter((item) => item.groupKey === key),
            spendTotal: result.spendTotals[benefit.id] ?? 0,
          },
        ];
      }),
    );
}

/**
 * The smallest tax-included price of one more item, bought under the benefit's conditions, that
 * fills the line's cap; `null` when no price does. A spend-tiers' price counts toward its total, so
 * the tier it reaches gives its rate to the item and to the plan's items in the cap. `without` are
 * line items left out as if not bought, such as an order being added.
 */
export function fillPrice(line: CapLine, taxRate: TaxRate, without: string[] = []): number | null {
  const { benefit } = line;
  const unit = benefit.params.roundingUnit;
  const sum = (points: Map<string, number>) => [...points.values()].reduce((a, b) => a + b, 0);
  const kept = line.items.filter((item) => !without.includes(item.lineItemId));
  // What the other plans and the other benefits sharing the cap earn: no price changes it.
  const fixed = line.raw - sum(pointsFor(line.items, line.rate, unit));
  const room = (rate: number) => line.cap - fixed - sum(pointsFor(kept, rate, unit));
  // The item is one order, so it is at least the order amount the benefit needs.
  const atLeast = (price: number | null) =>
    price === null || price === 0 ? price : Math.max(price, benefit.conditions.minOrderAmount ?? 0);
  if (benefit.kind !== "spend-tiers") {
    return atLeast(priceToFill(room(line.rate), taxRate, line.rate, benefit.amountBasis));
  }
  const removed = line.items.filter((item) => without.includes(item.lineItemId));
  const total = line.spendTotal - removed.reduce((acc, item) => acc + item.taxIncluded, 0);
  const prices = benefit.params.tiers.flatMap(({ minAmount, rate }) => {
    const price = priceToFill(room(rate), taxRate, rate, benefit.amountBasis);
    if (price === null) return [];
    const inTier = atLeast(Math.max(price, minAmount - total)) ?? 0;
    // A price past a higher tier earns at that tier's rate.
    const reached = spendTierRate(benefit.params.tiers, total + inTier);
    const earned = pointsForPrice(inTier, taxRate, reached, benefit.amountBasis);
    return earned >= room(reached) ? [inTier] : [];
  });
  return prices.length === 0 ? null : Math.min(...prices);
}

/** Caps that one price fills alike, shown as one row of 「上限までの残り」. */
export type CapRow = {
  lines: CapLine[];
  /** `fillPrice` of every line: 0 when they are filled, `null` when no price fills them. */
  price: number | null;
};

/**
 * The lines in the order their caps are filled: the least price first, then the ones no price
 * fills now, then the filled ones. Lines with the same price, cap, use, days and conditions are one
 * row.
 */
export function capRows(lines: CapLine[], taxRate: TaxRate): CapRow[] {
  const rows = new Map<string, CapRow>();
  for (const line of lines) {
    const price = line.remaining === 0 ? 0 : fillPrice(line, taxRate);
    const { dateRule, orderTags, shopTags, minOrderAmount } = line.benefit.conditions;
    const key = JSON.stringify([
      price,
      line.cap,
      line.usedHere,
      line.usedElsewhere,
      line.sharedWith,
      line.scope,
      line.period,
      dateRule,
      orderTags,
      shopTags,
      minOrderAmount,
    ]);
    const row = rows.get(key);
    if (row) row.lines.push(line);
    else rows.set(key, { lines: [line], price });
  }
  const group = ({ price }: CapRow) => (price === 0 ? 2 : price === null ? 1 : 0);
  return [...rows.values()].sort((a, b) => group(a) - group(b) || (a.price ?? 0) - (b.price ?? 0));
}
