import { taxExcludedTarget, taxIncludedTarget } from "../amounts/target-amount";
import { benefitKinds, pointsFor } from "../benefit-kinds";
import { channels } from "../channels";
import { matchesConditions } from "../conditions/matches";
import { type Order, orderShopContext } from "../model/order";
import type { Plan } from "../model/plan";
import type { Shop } from "../model/shop";
import { calculateAll } from "./calculate";
import { type CapLine, capLines, fillPrice } from "./cap-lines";

/** Where the points of an order not added yet go in one cap. */
export type CapFlow = {
  /** The cap, as it is with the order added. */
  line: CapLine;
  /** Points the order earns from the line's benefit, before the cap. */
  points: number;
  /**
   * The part of `points` the order receives. Earlier orders get the cap first and orders of one
   * day share it, as in the calculation.
   */
  into: number;
  /** The part of `points` beyond the cap. */
  over: number;
  /**
   * The price of the order's one item that fills the cap exactly with the other orders. `null`
   * when they fill it already, or when the order has several items, a quantity or a discount, so
   * one price does not set it.
   */
  fillPrice: number | null;
};

/**
 * For each cap of the plan the order's points go into, how much the order receives and how much
 * is over. Every plan is calculated with the order added to `planId`, so the order's shop can
 * raise the shop-around rate, for the order and for the orders already in the plan. `plans` must
 * have the accounts they are calculated with, and `shops` the order's shop. `asCalculated` turns
 * the plans with the order added into the plans as they are calculated (`planWithSpu`).
 */
export function capFlows(input: {
  plans: Plan[];
  shops: Shop[];
  planId: string;
  order: Order;
  asCalculated?: (plans: Plan[]) => Plan[];
}): CapFlow[] {
  const { shops, planId, order, asCalculated = (plans) => plans } = input;
  const plans = asCalculated(
    input.plans.map((plan) =>
      plan.id === planId ? { ...plan, orders: [...plan.orders, order] } : plan,
    ),
  );
  const plan = plans.find((other) => other.id === planId);
  const result = calculateAll(plans, shops).get(planId);
  if (!plan || !result) return [];
  const shop = shops.find((other) => other.id === order.shopId);
  const context = {
    ...orderShopContext(order, shop),
    shopId: order.shopId,
    date: order.date,
    orderTaxIncluded: order.lineItems.reduce((sum, item) => sum + taxIncludedTarget(item), 0),
    orderTags: order.tags,
  };
  const receives = context.channel !== null && channels[context.channel].receivesShopAround;
  const itemIds = new Set(order.lineItems.map((item) => item.id));
  const [only, ...rest] = order.lineItems;
  const single =
    only && rest.length === 0 && only.quantity === 1 && only.discount === 0 ? only : undefined;
  return capLines(plan, result).flatMap((line): CapFlow[] => {
    const { benefit } = line;
    // An occurrence's days are in its benefit's conditions, checked below.
    if (line.scope === "month" && !order.date.startsWith(line.period ?? "")) return [];
    if (benefitKinds[benefit.kind].onlyReceivingChannels && !receives) return [];
    if (!matchesConditions(benefit.conditions, context)) return [];
    const items = order.lineItems.map((item) => ({
      lineItemId: item.id,
      orderId: order.id,
      amount:
        benefit.amountBasis === "tax-included" ? taxIncludedTarget(item) : taxExcludedTarget(item),
    }));
    const earned = pointsFor(items, line.rate, benefit.params.roundingUnit);
    const points = [...earned.values()].reduce((sum, value) => sum + value, 0);
    if (points === 0) return [];
    const into = result.breakdown
      .filter((row) => row.source === benefit.id && itemIds.has(row.lineItemId))
      .reduce((sum, row) => sum + row.points, 0);
    // The price that fills what the other orders leave of the cap.
    const price = single ? fillPrice(line, single.taxRate, [...itemIds]) : null;
    return [{ line, points, into, over: points - into, fillPrice: price === 0 ? null : price }];
  });
}
