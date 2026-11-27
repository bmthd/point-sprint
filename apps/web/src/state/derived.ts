import {
  type Plan,
  type Shop,
  type CalculationResult,
  calculateAll,
  deepEqual,
  calculatedPlan,
  orderPoints,
  accountSettingsOf,
  bigOneMoreShopGain,
  oneMoreShopGain,
} from "@workspaces/domain";
import { replaceEqualDeep } from "@tanstack/query-core";
import { type Atom, atom } from "jotai";
import { type AtomFamily, atomFamily } from "jotai-family";
import { selectAtom } from "jotai/utils";
import {
  plansAtom,
  profileAtom,
  profileQueryAtom,
  shopsAtom,
  spuMonthsAtom,
} from "./query-atoms.ts";

/**
 * `source`, reusing the parts of its previous value that are equal to the new one. Atoms that read
 * a part of it then change only when that part does, comparing it by reference.
 */
export function sharedAtom<T>(source: Atom<T>) {
  return selectAtom(source, (next: T, previous?: T) => replaceEqualDeep(previous, next));
}

const planAtomRemovers: ((plan: Plan) => void)[] = [];

/**
 * Registers a family whose atoms belong to one plan: `ofPlan` tells whether the atom of `param`
 * does. Deleting the plan removes those atoms (`removePlanAtoms`).
 */
export function removedWithPlan<Param, AtomType>(
  family: AtomFamily<Param, AtomType>,
  ofPlan: (param: Param, plan: Plan) => boolean,
) {
  planAtomRemovers.push((plan) => {
    for (const param of family.getParams()) if (ofPlan(param, plan)) family.remove(param);
  });
  return family;
}

/** Removes the atoms of the plan from the families registered with `removedWithPlan`. */
export function removePlanAtoms(plan: Plan) {
  for (const remove of planAtomRemovers) remove(plan);
}

/** Whether a family keyed by plan id has the plan's atom. */
export function isPlanId(id: string, plan: Plan) {
  return id === plan.id;
}

/** Whether a family keyed by a plan id among others has the plan's atom. */
export function hasPlanId({ planId }: { planId: string }, plan: Plan) {
  return planId === plan.id;
}

/**
 * Whether the user tells accounts apart, and the accounts. Only the parts of the profile the
 * accounts are made of, so saving the profile without changing them does not recalculate every
 * plan.
 */
export const accountSettingsAtom = selectAtom(profileAtom, accountSettingsOf, deepEqual);

/**
 * Turns plans into the plans as they are calculated, for calculating plans with a change not
 * saved yet. Apply it after the change, so an order of a month the plan did not have gets its SPU.
 * `shops` defaults to the saved shops; pass the shops with the change when it adds or edits one.
 */
export const asCalculatedAtom = atom((get) => {
  const settings = get(accountSettingsAtom);
  const months = get(spuMonthsAtom);
  const savedShops = get(shopsAtom);
  return (plans: Plan[], shops: Shop[] = savedShops) =>
    plans.map((plan) => calculatedPlan(plan, settings, months, shops));
});

/**
 * Every plan as it is calculated. A plan, or a part of one, equal to the one calculated before is
 * that same object.
 */
export const calculatedPlansAtom = sharedAtom(atom((get) => get(asCalculatedAtom)(get(plansAtom))));

/**
 * Every plan at once, because caps can be shared between plans of the same account. Like the
 * calculated plans, a result or a part of one equal to the one before is that same object.
 */
export const calculationAtom = selectAtom(
  atom((get) => calculateAll(get(calculatedPlansAtom), get(shopsAtom))),
  (next, previous?: Map<string, CalculationResult>) =>
    new Map([...next].map(([id, result]) => [id, replaceEqualDeep(previous?.get(id), result)])),
);

export const planAtom = removedWithPlan(
  atomFamily((id: string) =>
    selectAtom(plansAtom, (plans) => plans.find((plan) => plan.id === id)),
  ),
  isPlanId,
);

/** The plan as it is calculated, with the SPU among its benefits. */
export const calculatedPlanAtom = removedWithPlan(
  atomFamily((id: string) =>
    selectAtom(calculatedPlansAtom, (plans) => plans.find((plan) => plan.id === id)),
  ),
  isPlanId,
);

type OrderKey = { planId: string; orderId: string };
const sameOrderKey = (a: OrderKey, b: OrderKey) => a.planId === b.planId && a.orderId === b.orderId;

export const orderAtom = removedWithPlan(
  atomFamily(
    ({ planId, orderId }: OrderKey) =>
      selectAtom(planAtom(planId), (plan) => plan?.orders.find((order) => order.id === orderId)),
    sameOrderKey,
  ),
  hasPlanId,
);

export const planResultAtom = removedWithPlan(
  atomFamily((id: string) => selectAtom(calculationAtom, (results) => results.get(id))),
  isPlanId,
);

/** The breakdown rows of one order's line items and their sum. */
export const orderPointsAtom = removedWithPlan(
  atomFamily(
    ({ planId, orderId }: OrderKey) =>
      sharedAtom(
        atom((get) => {
          const order = get(orderAtom({ planId, orderId }));
          return orderPoints(order, get(planResultAtom(planId))?.breakdown ?? []);
        }),
      ),
    sameOrderKey,
  ),
  hasPlanId,
);

type OneMoreShopKey = { planId: string; today: string | undefined };

/**
 * What one more shop of a 1000円ポッキリ adds to the plan, when it is 1,000P or more: otherwise
 * `null`. Recalculated only when the plans, shops or day change.
 */
export const bigOneMoreShopGainAtom = removedWithPlan(
  atomFamily(
    ({ planId, today }: OneMoreShopKey) =>
      atom((get) =>
        bigOneMoreShopGain(
          oneMoreShopGain({
            plans: get(calculatedPlansAtom),
            shops: get(shopsAtom),
            results: get(calculationAtom),
            planId,
            today,
          }),
        ),
      ),
    (a, b) => a.planId === b.planId && a.today === b.today,
  ),
  hasPlanId,
);

/** Whether the plan has a calculation, without subscribing to changes in its result. */
export const hasPlanResultAtom = removedWithPlan(
  atomFamily((id: string) => atom((get) => get(planResultAtom(id)) !== undefined)),
  isPlanId,
);

/** The names of just the plans sharing a cap, in the order shown beside it. */
export const planNamesAtom = removedWithPlan(
  atomFamily(
    (ids: string[]) =>
      selectAtom(
        plansAtom,
        (plans) => ids.flatMap((id) => plans.find((plan) => plan.id === id)?.name ?? []),
        deepEqual,
      ),
    deepEqual,
  ),
  (ids, plan) => ids.includes(plan.id),
);

/** Saved plan ids in the order shown on the top page. */
export const recentPlanIdsAtom = selectAtom(
  plansAtom,
  (plans) => [...plans].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).map((plan) => plan.id),
  deepEqual,
);

export const shopAtom = atomFamily((id: string) =>
  selectAtom(shopsAtom, (shops) => shops.find((shop) => shop.id === id)),
);

/** Shop ids in the registry name order, unchanged when only shop details change. */
export const sortedShopIdsAtom = selectAtom(
  shopsAtom,
  (shops) => [...shops].sort((a, b) => a.name.localeCompare(b.name, "ja")).map((shop) => shop.id),
  deepEqual,
);

export const accountAtom = atomFamily((id: string) =>
  selectAtom(
    accountSettingsAtom,
    (settings) => settings.accounts.find((account) => account.id === id),
    deepEqual,
  ),
);

export const accountIdsAtom = selectAtom(
  accountSettingsAtom,
  (settings) => settings.accounts.map((account) => account.id),
  deepEqual,
);

export const multiAccountEnabledAtom = atom((get) => get(accountSettingsAtom).enabled);

/** Whether account settings can be saved, without subscribing to the profile data. */
export const isProfileReadyAtom = atom((get) => get(profileQueryAtom).isSuccess);
