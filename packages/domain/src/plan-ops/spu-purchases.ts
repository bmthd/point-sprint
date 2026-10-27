import { taxIncludedTarget } from "../amounts/target-amount";
import { spuPurchaseRules } from "../master/spu";
import { orderShopContext, hasShop } from "../model/order";
import { type Plan, planAccountId } from "../model/plan";
import type { Shop } from "../model/shop";
import type { SpuMonth } from "../model/spu-month";
import { spuIdsIn } from "./spu-months";

/** An SPU item that an order achieves for an account in a month. */
export type SpuAchievement = { accountId: string; month: string; benefitId: string };

const keyOf = ({ accountId, month, benefitId }: SpuAchievement) =>
  `${accountId}|${month}|${benefitId}`;

/**
 * The SPU that the orders of `plans` achieve: an order that is not held, bought on the rule's
 * channel, of at least the rule's amount, achieves the rule's item for its plan's account in the
 * order's month. Orders whose shop is not in `shops` achieve none. `plans` must have the accounts
 * they are calculated with.
 */
export function spuAchievements(plans: Plan[], shops: Shop[]): SpuAchievement[] {
  const shopsById = new Map(shops.map((shop) => [shop.id, shop]));
  const achieved = new Map<string, SpuAchievement>();
  for (const plan of plans) {
    for (const order of plan.orders) {
      if (order.onHold) continue;
      const shop = hasShop(order) ? shopsById.get(order.shopId) : undefined;
      const { channel } = orderShopContext(order, shop);
      const amount = order.lineItems.reduce((sum, item) => sum + taxIncludedTarget(item), 0);
      for (const rule of spuPurchaseRules) {
        if (rule.channel !== channel || amount < rule.minOrderAmount) continue;
        const achievement = {
          accountId: planAccountId(plan),
          month: order.date.slice(0, 7),
          benefitId: rule.benefitId,
        };
        achieved.set(keyOf(achievement), achievement);
      }
    }
  }
  return [...achieved.values()];
}

/** The achievements of `after` that `before` does not have. */
function difference(from: SpuAchievement[], without: SpuAchievement[]): SpuAchievement[] {
  const keys = new Set(without.map(keyOf));
  return from.filter((achievement) => !keys.has(keyOf(achievement)));
}

const isOn = (months: SpuMonth[]) => (achievement: SpuAchievement) =>
  spuIdsIn(months, achievement.accountId, achievement.month).has(achievement.benefitId);

/**
 * The SPU that a change from `before` to `after` newly achieves. Each should be turned on; one
 * already achieved `before` is left as it is, so one the user turned off stays off until an order
 * achieves it again.
 */
export function newlyAchievedSpu(before: Plan[], after: Plan[], shops: Shop[]): SpuAchievement[] {
  return difference(spuAchievements(after, shops), spuAchievements(before, shops));
}

/**
 * The SPU that the orders of `before` achieved and those of `after` no longer do, and that are
 * still on in `months`: an order was held, deleted or changed so that no order of the account's
 * month meets the rule. `beforeShops` are the shops as they were before, when a shop's channel
 * changed with them.
 */
export function lostSpuPurchases(input: {
  before: Plan[];
  after: Plan[];
  shops: Shop[];
  beforeShops?: Shop[];
  months: SpuMonth[];
}): SpuAchievement[] {
  const { before, after, shops, beforeShops = shops, months } = input;
  return difference(spuAchievements(before, beforeShops), spuAchievements(after, shops)).filter(
    isOn(months),
  );
}

/** The SPU that the orders of `plan` achieve but that are off in `months`: the user turned them off. */
export function disabledAchievedSpu(
  plan: Plan,
  shops: Shop[],
  months: SpuMonth[],
): SpuAchievement[] {
  return spuAchievements([plan], shops).filter((achievement) => !isOn(months)(achievement));
}
