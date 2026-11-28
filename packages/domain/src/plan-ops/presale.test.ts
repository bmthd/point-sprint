import { describe, expect, test } from "vitest";
import { calculate } from "#/calculate/calculate.ts";
import { createPlan } from "#/master/create-plan.ts";
import { isRakumaBenefit } from "#/master/rakuma.ts";
import { MOBILE_SPU_ID, NORMAL_POINT_ID } from "#/master/spu.ts";
import { DEFAULT_ACCOUNT_ID } from "#/model/account.ts";
import type { OfficialEvent } from "#/model/official-event.ts";
import type { Order } from "#/model/order.ts";
import type { Plan } from "#/model/plan.ts";
import type { Shop } from "#/model/shop.ts";
import { type SpuMonth, spuMonthId } from "#/model/spu-month.ts";
import { calculatedPlan } from "./calculated-plan.ts";
import * as v from "valibot";
import { PresaleSchema } from "#/model/common.ts";
import { eventPlanPeriod, tokyoDateTime } from "./presale.ts";

const SHOP_AROUND_ID = "5a000000-0000-4000-8000-000000000001";

const superSale: OfficialEvent = {
  id: "supersale-2026-12-04",
  name: "楽天スーパーSALE",
  period: { start: "2026-12-04", end: "2026-12-11" },
  times: { start: "20:00", end: "01:59" },
  benefits: [
    {
      id: SHOP_AROUND_ID,
      kind: "shop-around",
      category: "campaign",
      label: "ショップ買いまわり",
      enabled: true,
      amountBasis: "tax-excluded",
      capScope: "campaign",
      sharedKey: "supersale-2026-12-04",
      conditions: {
        dateRule: { type: "range", start: "2026-12-04", end: "2026-12-11" },
        presale: {
          start: "2026-12-03T20:00+09:00",
          end: "2026-12-04T19:59+09:00",
          spuBenefitId: MOBILE_SPU_ID,
        },
      },
      params: {
        tiers: [
          { minShops: 2, rate: 1 },
          { minShops: 3, rate: 2 },
        ],
        cap: 7000,
        roundingUnit: "item",
      },
    },
  ],
};

const shops: Shop[] = ["a", "b", "c"].map((name) => ({
  id: `${name}0000000-0000-4000-8000-000000000001`,
  channel: "rakuten-ichiba",
  name,
  tags: [],
  updatedAt: "2026-11-28T00:00:00.000Z",
}));

const order = (index: number, date: string): Order => ({
  id: `0${index}000000-0000-4000-8000-000000000001`,
  shopId: shops[index]?.id ?? "",
  date,
  onHold: false,
  tags: [],
  lineItems: [
    {
      id: `1${index}000000-0000-4000-8000-000000000001`,
      name: "item",
      unitPrice: 11000,
      quantity: 1,
      taxRate: 0.1,
      discount: 0,
    },
  ],
});

let ids = 0;
const plan: Plan = {
  ...createPlan({
    id: "plan",
    name: "スーパーSALE",
    event: superSale,
    now: "2026-11-28T00:00:00.000Z",
    newId: () => `id${String(ids++).padStart(8, "0")}`,
  }),
  orders: [order(0, "2026-12-03"), order(1, "2026-12-05"), order(2, "2026-12-06")],
};

const december = (enabledIds: string[]): SpuMonth[] => [
  {
    id: spuMonthId(DEFAULT_ACCOUNT_ID, "2026-12"),
    accountId: DEFAULT_ACCOUNT_ID,
    month: "2026-12",
    enabledIds,
    updatedAt: "2026-11-28T00:00:00.000Z",
  },
];

const settings = { enabled: false, accounts: [] };

const shopAroundPoints = (result: ReturnType<typeof calculate>, orderIndex: number) =>
  result.breakdown.find(
    (row) =>
      row.source === SHOP_AROUND_ID &&
      row.lineItemId === `1${orderIndex}000000-0000-4000-8000-000000000001`,
  )?.points;

describe("先行セール", () => {
  test("a plan made from the event starts on the first day of its presale", () => {
    expect(eventPlanPeriod(superSale)).toEqual({ start: "2026-12-03", end: "2026-12-11" });
    expect(plan.period).toEqual({ start: "2026-12-03", end: "2026-12-11" });
  });

  test("ラクマ購入 +1倍 stays on the main period: it is for orders from 12-04 20:00", () => {
    const rakuma = { ...plan.benefits.find(isRakumaBenefit)!, enabled: true };
    const withRakuma = {
      ...plan,
      benefits: plan.benefits.map((benefit) => (isRakumaBenefit(benefit) ? rakuma : benefit)),
    };
    const months = december([NORMAL_POINT_ID, MOBILE_SPU_ID]);
    const result = calculate(calculatedPlan(withRakuma, settings, months, []), shops);
    const rakumaRows = result.breakdown.filter((row) => row.source === rakuma.id);
    expect(rakumaRows.map((row) => row.lineItemId)).toEqual([
      "11000000-0000-4000-8000-000000000001",
      "12000000-0000-4000-8000-000000000001",
    ]);
  });

  test("with 楽天モバイル on in December, the presale day's order counts in the shop-around", () => {
    const months = december([NORMAL_POINT_ID, MOBILE_SPU_ID]);
    const result = calculate(calculatedPlan(plan, settings, months, []), shops);
    expect(shopAroundPoints(result, 0)).toBe(200);
    expect(shopAroundPoints(result, 1)).toBe(200);
    expect(result.warnings).toEqual([
      { type: "order-on-period-edge", orderId: order(0, "2026-12-03").id, edge: "start" },
    ]);
  });

  test("without 楽天モバイル, the presale day's order is left out of the shop-around", () => {
    const months = december([NORMAL_POINT_ID]);
    const result = calculate(calculatedPlan(plan, settings, months, []), shops);
    expect(shopAroundPoints(result, 0)).toBeUndefined();
    // Two shops over the main period: +1倍.
    expect(shopAroundPoints(result, 1)).toBe(100);
    expect(result.warnings).toEqual([
      { type: "order-in-closed-presale", orderId: order(0, "2026-12-03").id },
    ]);
  });

  test("an order on the main period's first day is on its edge without 楽天モバイル", () => {
    const onFirstDay = { ...plan, orders: [order(1, "2026-12-04")] };
    const result = calculate(calculatedPlan(onFirstDay, settings, december([]), []), shops);
    expect(result.warnings).toEqual([
      { type: "order-on-period-edge", orderId: order(1, "2026-12-04").id, edge: "start" },
    ]);
  });

  test("the presale's moments fall on their day in Japan", () => {
    expect(tokyoDateTime("2026-12-04T19:59+09:00")).toEqual({ date: "2026-12-04", time: "19:59" });
    expect(tokyoDateTime("2026-12-04T20:00+09:00")).toEqual({ date: "2026-12-04", time: "20:00" });
    expect(tokyoDateTime("2026-12-03T14:59+00:00")).toEqual({ date: "2026-12-03", time: "23:59" });
    expect(tokyoDateTime("2026-12-03T15:00+00:00")).toEqual({ date: "2026-12-04", time: "00:00" });
  });

  test("a presale from just before midnight adds its day; one from midnight adds none", () => {
    const startingAt = (start: string): OfficialEvent => {
      const [benefit] = superSale.benefits;
      if (!benefit?.conditions.presale) throw new Error("no presale");
      const presale = { ...benefit.conditions.presale, start };
      return {
        ...superSale,
        benefits: [{ ...benefit, conditions: { ...benefit.conditions, presale } }],
      };
    };
    expect(eventPlanPeriod(startingAt("2026-12-03T23:59+09:00")).start).toBe("2026-12-03");
    expect(eventPlanPeriod(startingAt("2026-12-04T00:00+09:00")).start).toBe("2026-12-04");
  });

  test("the presale takes moments with an offset only", () => {
    const presale = (start: string) => ({
      start,
      end: "2026-12-04T19:59+09:00",
      spuBenefitId: MOBILE_SPU_ID,
    });
    expect(v.is(PresaleSchema, presale("2026-12-03T20:00+09:00"))).toBe(true);
    expect(v.is(PresaleSchema, presale("2026-12-03T20:00:00+09:00"))).toBe(true);
    expect(v.is(PresaleSchema, presale("2026-12-03T20:00"))).toBe(false);
    expect(v.is(PresaleSchema, presale("2026-12-03T11:00Z"))).toBe(false);
    expect(v.is(PresaleSchema, presale("2026-12-03"))).toBe(false);
  });
});
