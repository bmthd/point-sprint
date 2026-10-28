import * as v from "valibot";
import { orderPositions } from "../plan-ops/order-positions";
import { IdSchema, TimestampSchema } from "./common";
import { OrderSchema, type Order } from "./order";
import { type Plan, PlanSchema } from "./plan";

// A plan is stored as a row of its own and one row per order, so that two devices that change
// different orders of a plan keep both changes: the later `updatedAt` wins per row, not per plan.

const { orders: _orders, ...planEntries } = PlanSchema.entries;

/** A plan as stored: everything but its orders. `updatedAt` changes only with the plan's own fields. */
export const PlanRowSchema = v.object(planEntries);
export type PlanRow = v.InferOutput<typeof PlanRowSchema>;

const rowEntries = {
  planId: IdSchema,
  /** Orders are listed by position, then by id. */
  position: v.number(),
  updatedAt: TimestampSchema,
};

/** An order as stored, with the plan it is in. */
export const OrderRowSchema = v.union(
  OrderSchema.options.map((option) => v.object({ ...option.entries, ...rowEntries })) as [
    v.ObjectSchema<(typeof OrderSchema.options)[0]["entries"] & typeof rowEntries, undefined>,
    v.ObjectSchema<(typeof OrderSchema.options)[1]["entries"] & typeof rowEntries, undefined>,
  ],
);
export type OrderRow = v.InferOutput<typeof OrderRowSchema>;

/** JSON with the keys of every object sorted, so that equal values compare equal. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    typeof inner === "object" && inner !== null && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).toSorted(([a], [b]) => (a < b ? -1 : 1)))
      : inner,
  );
}

const orderOf = (row: OrderRow): Order => {
  const { planId: _planId, position: _position, updatedAt: _updatedAt, ...order } = row;
  return order as Order;
};

const rowOf = (plan: Plan): PlanRow => {
  const { orders: _, ...row } = plan;
  return row;
};

/**
 * The rows to write for `plan`, given the rows stored for it: the plan's row and the orders that
 * changed, with `plan.updatedAt`, and the ids of the orders it no longer has. A row that did not
 * change keeps its `updatedAt` and is left out (the plan's row is then `undefined`).
 */
export function splitPlan(
  plan: Plan,
  stored: { row?: PlanRow | undefined; orders: readonly OrderRow[] },
): { row: PlanRow | undefined; orders: OrderRow[]; removedOrderIds: string[] } {
  const { updatedAt } = plan;
  const nextRow = rowOf(plan);
  const sameRow =
    stored.row !== undefined &&
    stableJson({ ...nextRow, updatedAt: "" }) === stableJson({ ...stored.row, updatedAt: "" });

  const storedOrders = new Map(stored.orders.map((row) => [row.id, row]));
  const positions = orderPositions(
    new Map(stored.orders.map((row) => [row.id, row.position])),
    plan.orders.map((order) => order.id),
  );
  const orders = plan.orders.flatMap((order): OrderRow[] => {
    const before = storedOrders.get(order.id);
    const position = positions.get(order.id) ?? 0;
    if (
      before &&
      before.position === position &&
      stableJson(orderOf(before)) === stableJson(order)
    ) {
      return [];
    }
    return [{ ...order, planId: plan.id, position, updatedAt } as OrderRow];
  });
  const kept = new Set(plan.orders.map((order) => order.id));
  return {
    row: sameRow ? undefined : nextRow,
    orders,
    removedOrderIds: stored.orders.filter((row) => !kept.has(row.id)).map((row) => row.id),
  };
}

/**
 * The plan made of its row and its orders' rows. Its `updatedAt` is the latest of them all, so a
 * plan whose order changed on another device comes first in the lists ordered by it.
 */
export function joinPlan(row: PlanRow, orders: readonly OrderRow[]): Plan {
  const own = orders
    .filter((order) => order.planId === row.id)
    .toSorted((a, b) =>
      a.position !== b.position ? a.position - b.position : a.id < b.id ? -1 : 1,
    );
  const updatedAt = own.reduce(
    (latest, order) => (order.updatedAt > latest ? order.updatedAt : latest),
    row.updatedAt,
  );
  return { ...row, orders: own.map(orderOf), updatedAt };
}
