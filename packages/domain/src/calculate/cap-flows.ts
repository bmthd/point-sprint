import { taxExcludedTarget, taxIncludedTarget } from "../amounts/target-amount";
import { benefitKinds, pointsFor } from "../benefit-kinds";
import { channels } from "../channels";
import { matchesConditions } from "../conditions/matches";
import type { Order } from "../model/order";
import type { Shop } from "../model/shop";
import type { CapLine } from "./cap-lines";
import { priceToFill } from "./fill-price";

/** Where the points of an order not added yet go in one cap. */
export type CapFlow = {
  line: CapLine;
  /** Points the order earns from the line's benefit, before the cap. */
  points: number;
  /** The part of `points` the cap still has room for. */
  into: number;
  /** The part of `points` beyond the cap. */
  over: number;
  /**
   * The price of the order's one item that fills the cap exactly. `null` when the cap is full, or
   * when the order has several items, a quantity or a discount, so one price does not set it.
   */
  fillPrice: number | null;
};

/**
 * For each cap the order's points go into, how much fits and how much is over. `lines` must be
 * `capLines` of a calculation with the order added, for the order's date, so a shop-around rate
 * is the one the order's shop gives and the other orders' points are at that rate too.
 */
export function capFlows(input: {
  lines: CapLine[];
  order: Order;
  shop: Shop | undefined;
}): CapFlow[] {
  const { lines, order, shop } = input;
  const context = {
    channel: shop?.channel ?? null,
    shopTags: shop?.tags ?? null,
    shopId: order.shopId,
    date: order.date,
    orderTaxIncluded: order.lineItems.reduce((sum, item) => sum + taxIncludedTarget(item), 0),
    orderTags: order.tags,
  };
  const receives = context.channel !== null && channels[context.channel].receivesShopAround;
  const [only, ...rest] = order.lineItems;
  const single =
    only && rest.length === 0 && only.quantity === 1 && only.discount === 0 ? only : undefined;
  return lines.flatMap((line): CapFlow[] => {
    const { benefit } = line;
    if (line.period !== null && !order.date.startsWith(line.period)) return [];
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
    // What everything else leaves of the cap.
    const room = Math.max(0, line.cap - (line.raw - points));
    const into = Math.min(points, room);
    const fillPrice =
      single && room > 0 ? priceToFill(room, single.taxRate, line.rate, benefit.amountBasis) : null;
    return [{ line, points, into, over: points - into, fillPrice }];
  });
}
