import type { Migration } from "./runner";

type Row = Record<string, unknown>;
const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** One row per order, in the plan's order, dated like the plan. Orders that are not objects are left out. */
function orderRowsOf({ plans }: { plans: unknown[] }): unknown[] {
  return plans.flatMap((plan) => {
    if (!isRow(plan) || !Array.isArray(plan.orders)) return [];
    const { id: planId, updatedAt } = plan;
    return plan.orders.flatMap((order, position) =>
      isRow(order) ? [{ ...order, planId, position, updatedAt }] : [],
    );
  });
}

const withoutOrders = (row: unknown): unknown => {
  if (!isRow(row)) return row;
  const { orders: _, ...rest } = row;
  return rest;
};

/**
 * Moves the orders out of the plans into one row each (`orders`), so that two devices that change
 * different orders of a plan keep both changes.
 */
export const orderRowsMigration: Migration = {
  to: 11,
  stores: { plans: withoutOrders },
  seed: { store: "orders", rows: orderRowsOf },
};
