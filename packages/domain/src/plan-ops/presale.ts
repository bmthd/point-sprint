import type { Benefit } from "#/model/benefit.ts";
import type { Period, Presale } from "#/model/common.ts";
import type { OfficialEvent } from "#/model/official-event.ts";
import type { Plan } from "#/model/plan.ts";

/** The 先行セール of an event's or a plan's benefits: the first one that has it. */
export function presaleOf(benefits: Benefit[]): Presale | undefined {
  return benefits.find((benefit) => benefit.conditions.presale)?.conditions.presale;
}

/** The period of a plan made from `event`: from the first day of its 先行セール, when it has one. */
export function eventPlanPeriod(event: Pick<OfficialEvent, "period" | "benefits">): Period {
  const presale = presaleOf(event.benefits);
  return presale && presale.start < event.period.start
    ? { start: presale.start, end: event.period.end }
    : { ...event.period };
}

/**
 * Whether the plan's buyer can shop in the 先行セール: its SPU item is on in the month of its first
 * day. `plan` has the account's SPU (`planWithSpu`).
 */
export function presaleOpen(plan: Plan, presale: Presale): boolean {
  const month = presale.start.slice(0, 7);
  return plan.benefits.some(
    (benefit) =>
      benefit.id === presale.spuBenefitId &&
      benefit.enabled &&
      (benefit.conditions.months === undefined || benefit.conditions.months.includes(month)),
  );
}

/**
 * The plan with the days of each benefit's 先行セール added to its date rule, for a buyer who can
 * shop in it (`presaleOpen`). The other benefits, and every benefit of another buyer, stay as they
 * are. `plan` has the account's SPU (`planWithSpu`).
 */
export function withPresaleDays(plan: Plan): Plan {
  if (!plan.benefits.some((benefit) => benefit.conditions.presale)) return plan;
  return {
    ...plan,
    benefits: plan.benefits.map((benefit) => {
      const { presale, dateRule } = benefit.conditions;
      if (!presale || dateRule?.type !== "range" || presale.start >= dateRule.start) return benefit;
      if (!presaleOpen(plan, presale)) return benefit;
      return {
        ...benefit,
        conditions: { ...benefit.conditions, dateRule: { ...dateRule, start: presale.start } },
      };
    }),
  };
}
