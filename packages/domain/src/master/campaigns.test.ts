import * as v from "valibot";
import { describe, expect, test } from "vitest";
import { calculate } from "#/calculate/calculate.ts";
import { hasRakutenCardCampaign, rakutenCardLoss } from "#/calculate/rakuten-card.ts";
import { PlanSchema } from "#/model/plan.ts";
import { ShopSchema } from "#/model/shop.ts";
import { campaignTemplates } from "./campaigns.ts";
import { instantiateCampaign } from "./instantiate.ts";
import { CARD_NORMAL_ID, NORMAL_POINT_ID, PREMIUM_CARD_BONUS_ID, standardSpu } from "./spu.ts";

describe("楽天プレミアムカード 楽天市場コース", () => {
  const template = campaignTemplates.find((one) => one.id === "premium-card-ichiba");
  if (!template) throw new Error("no premium-card-ichiba campaign");
  const premium = instantiateCampaign(template, { id: "pc00000000" });

  const shops = [
    v.parse(ShopSchema, {
      id: "a0000000-0000-4000-8000-000000000001",
      name: "shop",
      channel: "rakuten-ichiba",
      tags: [],
      updatedAt: "2026-10-04T00:00:00Z",
    }),
  ];
  /** One order of one item at `unitPrice` yen with tax on `date`. */
  const orderOn = (index: number, date: string, unitPrice = 10000) => ({
    id: `0200000${index}-0000-4000-8000-000000000001`,
    shopId: shops[0]?.id,
    date,
    lineItems: [
      {
        id: `2000000${index}-0000-4000-8000-000000000001`,
        name: "item",
        unitPrice,
        quantity: 1,
        taxRate: 0.1,
        discount: 0,
      },
    ],
    onHold: false,
    tags: [],
  });
  /** A plan with 通常ポイント, the SPU items `spuIds` and the 楽天市場コース. */
  const planWith = (orders: object[], spuIds: string[] = []) =>
    v.parse(PlanSchema, {
      id: "f0000000-0000-4000-8000-000000000002",
      name: "plan",
      period: { start: "2026-10-04", end: "2026-10-11" },
      benefits: [
        ...structuredClone(standardSpu).map((benefit) => ({
          ...benefit,
          enabled: benefit.id === NORMAL_POINT_ID || spuIds.includes(benefit.id),
        })),
        premium,
      ],
      orders,
      updatedAt: "2026-10-04T00:00:00Z",
    });
  const pointsOf = (result: ReturnType<typeof calculate>, benefitId: string) =>
    result.benefitTotals.find((total) => total.benefitId === benefitId)?.cappedPoints;

  test("is on once added", () => {
    expect(premium.enabled).toBe(true);
  });

  test("adds +1 on the tax-included amount of Tuesday and Thursday orders only", () => {
    // 2026-10-05 is a Monday, 10-06 a Tuesday, 10-08 a Thursday.
    const result = calculate(
      planWith([orderOn(1, "2026-10-05"), orderOn(2, "2026-10-06"), orderOn(3, "2026-10-08")]),
      shops,
    );
    // 100 points for each of the two orders of 10,000 yen with tax (90 each without tax).
    expect(pointsOf(result, premium.id)).toBe(200);
  });

  test("stops at 10,000 points a month", () => {
    const result = calculate(planWith([orderOn(1, "2026-10-06", 2_000_000)]), shops);
    expect(pointsOf(result, premium.id)).toBe(10000);
  });

  test("comes on top of the SPU premium card bonus, each with its own cap", () => {
    const result = calculate(
      planWith([orderOn(1, "2026-10-06", 2_000_000)], [CARD_NORMAL_ID, PREMIUM_CARD_BONUS_ID]),
      shops,
    );
    expect(pointsOf(result, PREMIUM_CARD_BONUS_ID)).toBe(5000);
    expect(pointsOf(result, premium.id)).toBe(10000);
  });

  test("is left out of an order paid otherwise than with a 楽天カード", () => {
    const order = { ...orderOn(1, "2026-10-06"), rakutenCard: false };
    const plan = planWith([order]);
    expect(pointsOf(calculate(plan, shops), premium.id) ?? 0).toBe(0);
    expect(hasRakutenCardCampaign(plan)).toBe(true);
    expect(rakutenCardLoss({ plans: [plan], shops, planId: plan.id, orderId: order.id })).toEqual({
      points: 100,
      parts: ["ichiba-course"],
    });
  });
});
