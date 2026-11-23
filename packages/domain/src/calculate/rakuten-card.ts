import { RAKUTEN_CARD_PARTS, type RakutenCardPart } from "#/master/spu.ts";
import { withRakutenCard } from "#/model/order.ts";
import type { Plan } from "#/model/plan.ts";
import type { Shop } from "#/model/shop.ts";
import { calculateAll } from "./calculate.ts";

const PART_ORDER: readonly RakutenCardPart[] = ["normal", "bonus", "bank", "ichiba-course"];

/** Whether the plan has a campaign on that only orders paid with a 楽天カード get (楽天市場コース). */
export function hasRakutenCardCampaign(plan: Plan): boolean {
  return plan.benefits.some(
    (benefit) =>
      benefit.enabled &&
      benefit.conditions.rakutenCard === true &&
      !RAKUTEN_CARD_PARTS.has(benefit.id),
  );
}

/**
 * What paying the order otherwise loses: the points it gets, after their caps, from the items that
 * only orders paid with a 楽天カード get, when it is paid with the card. `parts` are those items'
 * kinds, the card's normal points, its bonus, 楽天銀行's and the card's campaigns, in that order. `plans` are the
 * plans as they are calculated, with the order in `planId`, paid either way.
 */
export function rakutenCardLoss(input: {
  plans: Plan[];
  shops: Shop[];
  planId: string;
  orderId: string;
}): { points: number; parts: RakutenCardPart[] } {
  const { shops, planId, orderId } = input;
  const plans = input.plans.map((plan) =>
    plan.id === planId
      ? {
          ...plan,
          orders: plan.orders.map((order) =>
            order.id === orderId ? withRakutenCard(order, true) : order,
          ),
        }
      : plan,
  );
  const itemIds = new Set(
    plans
      .find((plan) => plan.id === planId)
      ?.orders.find((order) => order.id === orderId)
      ?.lineItems.map((item) => item.id),
  );
  const campaignIds = new Set(
    plans
      .find((plan) => plan.id === planId)
      ?.benefits.filter(
        (benefit) => benefit.conditions.rakutenCard === true && !RAKUTEN_CARD_PARTS.has(benefit.id),
      )
      .map((benefit) => benefit.id),
  );
  const partOf = (source: string): RakutenCardPart | undefined =>
    RAKUTEN_CARD_PARTS.get(source) ?? (campaignIds.has(source) ? "ichiba-course" : undefined);
  const rows = (calculateAll(plans, shops).get(planId)?.breakdown ?? []).filter(
    (row) => itemIds.has(row.lineItemId) && partOf(row.source) !== undefined && row.points > 0,
  );
  const parts = new Set(rows.map((row) => partOf(row.source)));
  return {
    points: rows.reduce((sum, row) => sum + row.points, 0),
    parts: PART_ORDER.filter((part) => parts.has(part)),
  };
}
