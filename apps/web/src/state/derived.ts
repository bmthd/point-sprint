import { type BreakdownRow, calculateAll } from "@workspaces/domain";
import { atom } from "jotai";
import { atomFamily } from "jotai-family";
import { selectAtom } from "jotai/utils";
import { accountSettingsOf, withEffectiveAccount } from "./accounts";
import { plansAtom, profileAtom, shopsAtom } from "./queries";

/** Structural equality for the plain data that plans and calculation results are made of. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return (
    keysA.length === keysB.length &&
    keysA.every(
      (key) =>
        Object.hasOwn(b, key) &&
        deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
  );
}

/**
 * Whether the user tells accounts apart, and the accounts. Only the parts of the profile the
 * accounts are made of, so a change to the SPU defaults does not recalculate every plan.
 */
export const accountSettingsAtom = selectAtom(profileAtom, accountSettingsOf, deepEqual);

/** Every plan at once, because caps can be shared between plans of the same account. */
export const calculationAtom = atom((get) => {
  const settings = get(accountSettingsAtom);
  const plans = get(plansAtom).map((plan) => withEffectiveAccount(plan, settings));
  return calculateAll(plans, get(shopsAtom));
});

export const planAtom = atomFamily((id: string) =>
  selectAtom(plansAtom, (plans) => plans.find((plan) => plan.id === id)),
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

export type OrderPoints = { rows: BreakdownRow[]; total: number };

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
        const lineItemIds = new Set(order?.lineItems.map((item) => item.id));
        const rows =
          get(planResultAtom(planId))?.breakdown.filter((row) => lineItemIds.has(row.lineItemId)) ??
          [];
        return { rows, total: rows.reduce((sum, row) => sum + row.points, 0) };
      }),
      (points) => points,
      sameRows,
    ),
  sameOrderKey,
);
