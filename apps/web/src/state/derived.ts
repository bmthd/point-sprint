import {
  type OrderPoints,
  type Plan,
  type Shop,
  calculateAll,
  deepEqual,
  calculatedPlan,
  orderPoints,
  accountSettingsOf,
  bigOneMoreShopGain,
  oneMoreShopGain,
} from "@workspaces/domain";
import { atom } from "jotai";
import { atomFamily } from "jotai-family";
import { selectAtom } from "jotai/utils";
import {
  plansAtom,
  profileAtom,
  profileQueryAtom,
  shopsAtom,
  spuMonthsAtom,
} from "./query-atoms.ts";

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

/** Every plan as it is calculated. */
export const calculatedPlansAtom = atom((get) => get(asCalculatedAtom)(get(plansAtom)));

/** Every plan at once, because caps can be shared between plans of the same account. */
export const calculationAtom = atom((get) =>
  calculateAll(get(calculatedPlansAtom), get(shopsAtom)),
);

export const planAtom = atomFamily((id: string) =>
  selectAtom(plansAtom, (plans) => plans.find((plan) => plan.id === id)),
);

/** The plan as it is calculated, with the SPU among its benefits. */
export const calculatedPlanAtom = atomFamily((id: string) =>
  selectAtom(calculatedPlansAtom, (plans) => plans.find((plan) => plan.id === id), deepEqual),
);

type OrderKey = { planId: string; orderId: string };
const sameOrderKey = (a: OrderKey, b: OrderKey) => a.planId === b.planId && a.orderId === b.orderId;

export const orderAtom = atomFamily(
  ({ planId, orderId }: OrderKey) =>
    selectAtom(planAtom(planId), (plan) => plan?.orders.find((order) => order.id === orderId)),
  sameOrderKey,
);

export const planResultAtom = atomFamily((id: string) =>
  selectAtom(calculationAtom, (results) => results.get(id), deepEqual),
);

const sameRows = (a: OrderPoints, b: OrderPoints) =>
  a.total === b.total &&
  a.rows.length === b.rows.length &&
  a.rows.every((row, index) => {
    const other = b.rows[index];
    return (
      other !== undefined &&
      row.lineItemId === other.lineItemId &&
      row.source === other.source &&
      row.points === other.points
    );
  });

/** The breakdown rows of one order's line items and their sum. */
export const orderPointsAtom = atomFamily(
  ({ planId, orderId }: OrderKey) =>
    selectAtom(
      atom((get) => {
        const order = get(orderAtom({ planId, orderId }));
        return orderPoints(order, get(planResultAtom(planId))?.breakdown ?? []);
      }),
      (points) => points,
      sameRows,
    ),
  sameOrderKey,
);

type OneMoreShopKey = { planId: string; today: string | undefined };

/**
 * What one more shop of a 1000円ポッキリ adds to the plan, when it is 1,000P or more: otherwise
 * `null`. Recalculated only when the plans, shops or day change.
 */
export const bigOneMoreShopGainAtom = atomFamily(
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
);

/** Whether the plan has a calculation, without subscribing to changes in its result. */
export const hasPlanResultAtom = atomFamily((id: string) =>
  atom((get) => get(planResultAtom(id)) !== undefined),
);

/** The names of just the plans sharing a cap, in the order shown beside it. */
export const planNamesAtom = atomFamily(
  (ids: string[]) =>
    selectAtom(
      plansAtom,
      (plans) => ids.flatMap((id) => plans.find((plan) => plan.id === id)?.name ?? []),
      deepEqual,
    ),
  deepEqual,
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
