import type { ChannelId, Conditions, OrderTag, ShopTag } from "../model/common";

export interface ConditionContext {
  /** `null` when the order's shop is not in the shop registry. */
  channel: ChannelId | null;
  /** `null` when the order's shop is not in the shop registry. */
  shopTags: ShopTag[] | null;
  shopId: string;
  date: string;
  orderTaxIncluded: number;
  orderTags: OrderTag[];
}

export function matchesConditions(conditions: Conditions, ctx: ConditionContext): boolean {
  const { channels, shopIds, shopTags, dateRule, minOrderAmount, orderTags } = conditions;
  if (channels && (ctx.channel === null || !channels.includes(ctx.channel))) return false;
  if (shopIds && !shopIds.includes(ctx.shopId)) return false;
  if (
    shopTags &&
    (ctx.shopTags === null || !shopTags.every((tag) => ctx.shopTags?.includes(tag)))
  ) {
    return false;
  }
  if (dateRule) {
    if (dateRule.type === "daysOfMonth") {
      const day = Number(ctx.date.slice(8, 10));
      if (!dateRule.days.includes(day)) return false;
    } else if (dateRule.type === "dates") {
      if (!dateRule.dates.includes(ctx.date)) return false;
    } else if (ctx.date < dateRule.start || ctx.date > dateRule.end) {
      return false;
    }
  }
  if (minOrderAmount !== undefined && ctx.orderTaxIncluded < minOrderAmount) return false;
  if (orderTags && !orderTags.every((tag) => ctx.orderTags.includes(tag))) return false;
  return true;
}
