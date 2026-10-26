import { CARRIED_SPU_IDS, NORMAL_POINT_ID, standardSpu } from "../master/spu";
import type { Benefit } from "../model/benefit";
import { monthsOf } from "../model/common";
import { type Plan, planAccountId } from "../model/plan";
import type { SpuMonth } from "../model/spu-month";
import { toggleBenefits } from "./benefit-ops";

/**
 * The ids of the SPU that are on for `accountId` in `month` (`YYYY-MM`). A month not stored yet
 * takes the carried items (`CARRIED_SPU_IDS`) of the account's nearest earlier stored month, and
 * starts with every other item off. 通常ポイント is always on.
 */
export function spuIdsIn(months: SpuMonth[], accountId: string, month: string): Set<string> {
  const own = months.filter((candidate) => candidate.accountId === accountId);
  const stored = own.find((candidate) => candidate.month === month);
  if (stored) return new Set([NORMAL_POINT_ID, ...stored.enabledIds]);
  const previous = own
    .filter((candidate) => candidate.month < month)
    .reduce<SpuMonth | undefined>(
      (nearest, candidate) => (nearest && nearest.month > candidate.month ? nearest : candidate),
      undefined,
    );
  const carried = previous?.enabledIds.filter((id) => CARRIED_SPU_IDS.has(id)) ?? [];
  return new Set([NORMAL_POINT_ID, ...carried]);
}

/** `standardSpu`, each item on exactly when `ids` has it. */
export const spuBenefitsOf = (ids: ReadonlySet<string>): Benefit[] =>
  standardSpu.map((benefit) => ({ ...structuredClone(benefit), enabled: ids.has(benefit.id) }));

/**
 * The ids that are on after toggling `benefitId`, with the rules of `toggleBenefits`: one item of
 * an exclusive group, and the card's normal points with its bonus.
 */
export const toggleSpu = (ids: ReadonlySet<string>, benefitId: string): string[] =>
  toggleBenefits(spuBenefitsOf(ids), benefitId)
    .filter((benefit) => benefit.enabled)
    .map((benefit) => benefit.id);

/** `ids` with `benefitIds` on, through `toggleSpu` so that the same rules hold. */
export function enableSpu(ids: ReadonlySet<string>, benefitIds: Iterable<string>): string[] {
  let current = new Set(ids);
  for (const id of benefitIds) {
    if (!current.has(id)) current = new Set(toggleSpu(current, id));
  }
  return [...current];
}

/** The months a plan's SPU is for: those of its period and those of its orders. */
export const spuMonthsOfPlan = (plan: Plan): string[] =>
  [
    ...new Set([...monthsOf(plan.period), ...plan.orders.map((order) => order.date.slice(0, 7))]),
  ].sort();

/**
 * The plans the SPU of `accountId` in `month` is used by, with how many of their orders are of
 * the month: those of the account that `spuMonthsOfPlan` gives the month. `plans` must have the
 * accounts they are calculated with.
 */
export const plansUsingSpuMonth = (
  plans: Plan[],
  accountId: string,
  month: string,
): { plan: Plan; orders: number }[] =>
  plans
    .filter((plan) => planAccountId(plan) === accountId && spuMonthsOfPlan(plan).includes(month))
    .map((plan) => ({
      plan,
      orders: plan.orders.filter((order) => order.date.startsWith(month)).length,
    }));

/**
 * The plan as it is calculated: every `standardSpu` item added to its benefits, on for the orders
 * of the months its account has it on (`conditions.months`). `plan` must have the account it is
 * calculated with. Items the plan holds itself are left to the plan.
 */
export function planWithSpu(plan: Plan, months: SpuMonth[]): Plan {
  const accountId = planAccountId(plan);
  const idsByMonth = spuMonthsOfPlan(plan).map(
    (month) => [month, spuIdsIn(months, accountId, month)] as const,
  );
  const own = new Set(plan.benefits.map((benefit) => benefit.id));
  const spu = standardSpu
    .filter((benefit) => !own.has(benefit.id))
    .map((benefit): Benefit => {
      const on = idsByMonth.filter(([, ids]) => ids.has(benefit.id)).map(([month]) => month);
      return {
        ...structuredClone(benefit),
        enabled: on.length > 0,
        conditions: { ...structuredClone(benefit.conditions), months: on },
      };
    });
  return { ...plan, benefits: [...spu, ...plan.benefits] };
}
