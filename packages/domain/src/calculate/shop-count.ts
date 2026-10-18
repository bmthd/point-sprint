import { taxIncludedTarget } from "../amounts/target-amount";
import { channels } from "../channels";
import { inDateRule } from "../conditions/matches";
import type { DateRule } from "../model/common";
import { type Order, hasShop } from "../model/order";
import type { Shop } from "../model/shop";

/** Minimum tax-included target amount per shop to count toward shop-around (inclusive). */
export const SHOP_AROUND_MIN_AMOUNT = 1000;

/**
 * Shops over the days of `dateRule`, or over `period` when there is none: a campaign of its own
 * days, added to a longer plan, counts only the orders of its days. Held orders (`onHold`) never
 * count.
 */
export function countShops(
  orders: Order[],
  shops: Shop[],
  period: { start: string; end: string },
  dateRule?: DateRule,
): number {
  const inDays = (date: string) =>
    dateRule ? inDateRule(dateRule, date) : date >= period.start && date <= period.end;
  const totals = new Map<string, number>();
  let count = 0;
  for (const order of orders) {
    if (order.onHold) continue;
    if (!inDays(order.date)) continue;
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
