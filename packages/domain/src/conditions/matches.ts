import type { ChannelId, Conditions, DateRule, OrderTag, ShopTag } from "../model/common";

export interface ConditionContext {
  /** `null` when the order's shop is not in the shop registry. */
  channel: ChannelId | null;
  /** `null` when the order's shop is not in the shop registry. */
  shopTags: ShopTag[] | null;
  shopId: string | undefined;
  date: string;
  orderTaxIncluded: number;
  orderTags: OrderTag[];
}

export function matchesConditions(conditions: Conditions, ctx: ConditionContext): boolean {
  const { channels, shopIds, shopTags, dateRule, minOrderAmount, orderTags, months } = conditions;
  if (channels && (ctx.channel === null || !channels.includes(ctx.channel))) return false;
  if (shopIds && (ctx.shopId === undefined || !shopIds.includes(ctx.shopId))) return false;
  if (
    shopTags &&
    (ctx.shopTags === null || !shopTags.every((tag) => ctx.shopTags?.includes(tag)))
  ) {
    return false;
  }
  if (dateRule && !inDateRule(dateRule, ctx.date)) return false;
  if (minOrderAmount !== undefined && ctx.orderTaxIncluded < minOrderAmount) return false;
  if (orderTags && !orderTags.every((tag) => ctx.orderTags.includes(tag))) return false;
  if (months && !months.includes(ctx.date.slice(0, 7))) return false;
  return true;
}

/** Whether `date` is one of the days of `rule`. */
export function inDateRule(rule: DateRule, date: string): boolean {
  switch (rule.type) {
    case "daysOfMonth":
      return rule.days.includes(Number(date.slice(8, 10)));
    case "dates":
      return rule.dates.includes(date);
    case "range":
      return date >= rule.start && date <= rule.end;
  }
}
