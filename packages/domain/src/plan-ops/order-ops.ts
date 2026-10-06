import type { Id } from "../model/common";
import type { Plan } from "../model/plan";

function indexOfOrder(plan: Plan, orderId: string): number {
  const index = plan.orders.findIndex((order) => order.id === orderId);
  if (index === -1) throw new Error(`order ${orderId} is not in plan ${plan.id}`);
  return index;
}

/**
 * Returns a plan with a copy of the order right after it. The copy and its line items all get
 * new IDs from `newId`. The given plan is not changed.
 */
export function copyOrder(plan: Plan, orderId: string, newId: () => Id): Plan {
  const index = indexOfOrder(plan, orderId);
  const original = structuredClone(plan.orders[index]);
  if (!original) throw new Error(`order ${orderId} is not in plan ${plan.id}`);
  const copy = {
    ...original,
    id: newId(),
    lineItems: original.lineItems.map((item) => ({ ...item, id: newId() })),
  };
  const orders = [...plan.orders];
  orders.splice(index + 1, 0, copy);
  return { ...plan, orders };
}

/**
 * Returns a plan with the order moved to `toIndex` (0-based; out-of-range indexes are clamped to
 * the ends). The given plan is not changed.
 */
export function moveOrder(plan: Plan, orderId: string, toIndex: number): Plan {
  const from = indexOfOrder(plan, orderId);
  const orders = [...plan.orders];
  const [moved] = orders.splice(from, 1);
  if (!moved) throw new Error(`order ${orderId} is not in plan ${plan.id}`);
  const to = Math.min(Math.max(Math.trunc(toIndex), 0), orders.length);
  orders.splice(to, 0, moved);
  return { ...plan, orders };
}
