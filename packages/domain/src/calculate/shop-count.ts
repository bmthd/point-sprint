import { taxIncludedTarget } from "../amounts/target-amount";
import { channels } from "../channels";
import type { Order } from "../model/order";
import type { Shop } from "../model/shop";

/** Minimum tax-included target amount per shop to count toward shop-around (inclusive). */
export const SHOP_AROUND_MIN_AMOUNT = 1000;

/** Held orders (`onHold`) never count. */
export function countShops(
  orders: Order[],
  shops: Shop[],
  period: { start: string; end: string },
): number {
  const totals = new Map<string, number>();
  for (const order of orders) {
    if (order.onHold) continue;
    if (order.date < period.start || order.date > period.end) continue;
    const sum = order.lineItems.reduce((acc, item) => acc + taxIncludedTarget(item), 0);
    totals.set(order.shopId, (totals.get(order.shopId) ?? 0) + sum);
  }
  let count = 0;
  for (const shop of shops) {
    if (!channels[shop.channel].countsTowardShopAround) continue;
    if ((totals.get(shop.id) ?? 0) >= SHOP_AROUND_MIN_AMOUNT) count++;
  }
  return count;
}
