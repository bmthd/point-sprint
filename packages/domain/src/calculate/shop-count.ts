import { taxIncludedTarget } from "../amounts/target-amount";
import { channels } from "../channels";
import { type Order, hasShop } from "../model/order";
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
  let count = 0;
  for (const order of orders) {
    if (order.onHold) continue;
    if (order.date < period.start || order.date > period.end) continue;
    const sum = order.lineItems.reduce((acc, item) => acc + taxIncludedTarget(item), 0);
    if (!hasShop(order)) {
      if (channels[order.channel].countsTowardShopAround && sum >= SHOP_AROUND_MIN_AMOUNT) count++;
      continue;
    }
    totals.set(order.shopId, (totals.get(order.shopId) ?? 0) + sum);
  }
  for (const shop of shops) {
    if (!channels[shop.channel].countsTowardShopAround) continue;
    if ((totals.get(shop.id) ?? 0) >= SHOP_AROUND_MIN_AMOUNT) count++;
  }
  return count;
}
