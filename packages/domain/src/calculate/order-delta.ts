import type { Order } from "#/model/order.ts";
import { orderPoints } from "./order-points.ts";
import type { CalculationResult } from "./types.ts";

/** 上限適用後のプラン合計の増減と、この注文・既存注文への内訳。 */
export function orderDelta({
  before,
  after,
  order,
  original,
}: {
  before: CalculationResult | undefined;
  after: CalculationResult | undefined;
  order: Order;
  original: Order | undefined;
}) {
  const total = (after?.total ?? 0) - (before?.total ?? 0);
  const orderGain =
    orderPoints(order, after?.breakdown ?? []).total -
    orderPoints(original, before?.breakdown ?? []).total;
  return { total, orderGain, othersGain: total - orderGain };
}
