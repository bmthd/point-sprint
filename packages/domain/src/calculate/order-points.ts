import type { Order } from "#/model/order.ts";
import type { BreakdownRow } from "./types.ts";

export type OrderPoints = { rows: BreakdownRow[]; total: number };

/** The breakdown rows of one order's line items and their capped points. */
export function orderPoints(
  order: Order | undefined,
  breakdown: readonly BreakdownRow[],
): OrderPoints {
  const lineItemIds = new Set(order?.lineItems.map((item) => item.id));
  const rows = breakdown.filter((row) => lineItemIds.has(row.lineItemId));
  return { rows, total: rows.reduce((sum, row) => sum + row.points, 0) };
}
