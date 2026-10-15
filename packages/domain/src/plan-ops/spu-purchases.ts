import { taxIncludedTarget } from "../amounts/target-amount";
import { spuPurchaseRules } from "../master/spu";
import { orderShopContext, hasShop } from "../model/order";
import type { Plan } from "../model/plan";
import type { Shop } from "../model/shop";
import { toggleBenefits } from "./benefit-ops";

/**
 * The SPU benefits of the plan that its orders achieve: an order that is not held, bought on the
 * rule's channel, of at least the rule's amount. Orders whose shop is not in `shops` achieve none.
 */
export function achievedSpuPurchases(plan: Plan, shops: Shop[]): Set<string> {
  const shopsById = new Map(shops.map((shop) => [shop.id, shop]));
  const achieved = new Set<string>();
  for (const order of plan.orders) {
    if (order.onHold) continue;
    const shop = hasShop(order) ? shopsById.get(order.shopId) : undefined;
    const { channel } = orderShopContext(order, shop);
    const amount = order.lineItems.reduce((sum, item) => sum + taxIncludedTarget(item), 0);
    for (const rule of spuPurchaseRules) {
      if (rule.channel === channel && amount >= rule.minOrderAmount) achieved.add(rule.benefitId);
    }
  }
  return new Set(plan.benefits.filter((benefit) => achieved.has(benefit.id)).map((b) => b.id));
}

/** The achieved SPU benefits that are off: the user turned them off over their orders. */
export const disabledAchievedSpu = (plan: Plan, shops: Shop[]): string[] => {
  const achieved = achievedSpuPurchases(plan, shops);
  return plan.benefits
    .filter((benefit) => achieved.has(benefit.id) && !benefit.enabled)
    .map((benefit) => benefit.id);
};

/**
 * `after` with the SPU benefits its orders newly achieve turned on. A benefit already achieved
 * `before` is left as it is, so one the user turned off stays off until an order achieves it again.
 */
export function enableAchievedSpu(before: Plan | undefined, after: Plan, shops: Shop[]): Plan {
  const already = before ? achievedSpuPurchases(before, shops) : new Set<string>();
  let benefits = after.benefits;
  for (const id of achievedSpuPurchases(after, shops)) {
    if (already.has(id)) continue;
    if (benefits.find((benefit) => benefit.id === id)?.enabled !== false) continue;
    benefits = toggleBenefits(benefits, id);
  }
  return benefits === after.benefits ? after : { ...after, benefits };
}
