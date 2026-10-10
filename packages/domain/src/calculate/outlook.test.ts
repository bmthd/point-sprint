import { describe, expect, test } from "vitest";
import type { Benefit } from "../model/benefit";
import type { Order } from "../model/order";
import type { Plan } from "../model/plan";
import type { Shop } from "../model/shop";
import { calculate, calculateAll } from "./calculate";
import { shopAroundOutlook } from "./outlook";

const TIERS = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((minShops) => ({ minShops, rate: minShops - 1 }));
const BENEFIT_ID = "5a000000-0000-4000-8000-000000000001";

/** Tiers 2 → +1 … 10 → +9, receiving base 10,200 yen excl. tax. */
const outlook = (
  shopCount: number,
  cap: number | null = 7000,
  over: Partial<Parameters<typeof shopAroundOutlook>[0]> = {},
) =>
  shopAroundOutlook({
    benefitId: BENEFIT_ID,
    tiers: TIERS,
    cap: cap ?? undefined,
    amountBasis: "tax-excluded",
    shopCount,
    receivingBase: 10200,
    ...over,
  });

describe("shopAroundOutlook", () => {
  test("rows from current shop count to ten", () => {
    const result = outlook(4);
    expect(result.currentRate).toBe(3);
    expect(result.rows).toHaveLength(7);
    expect(result.rows[0]).toMatchObject({ shops: 4, rate: 3 });
    expect(result.rows.at(-1)).toMatchObject({ shops: 10, rate: 9 });
  });

  test("remaining amount until cap", () => {
    const row = outlook(4).rows[0];
    expect(row?.remainingTaxExcluded).toBe(223134);
    expect(row?.remainingTaxIncludedApprox).toBe(Math.floor((223134 * 11) / 10));
  });

  test("remaining amount is null without a cap", () => {
    const row = outlook(4, null).rows[0];
    expect(row?.remainingTaxExcluded).toBeNull();
    expect(row?.remainingTaxIncludedApprox).toBeNull();
  });

  test("points with the current basket at each shop count stop at the cap", () => {
    const result = outlook(3, 7000, { receivingBase: 120000 });
    expect(result.rows.map((row) => row.points)).toEqual([
      2400, 3600, 4800, 6000, 7000, 7000, 7000, 7000,
    ]);
  });

  test("points are not capped without a cap", () => {
    expect(outlook(3, null, { receivingBase: 1000000 }).rows.at(-1)?.points).toBe(90000);
  });

  test("next shop gain", () => {
    expect(outlook(4).nextShop).toEqual({ rateDelta: 1, pointsGain: 102 });
  });

  test("no next shop at top tier", () => {
    const result = outlook(10);
    expect(result.nextShop).toBeNull();
    expect(result.rows).toHaveLength(1);
  });

  test("rows do not grow beyond the top tier", () => {
    const result = outlook(12);
    expect(result.nextShop).toBeNull();
    expect(result.rows).toEqual([expect.objectContaining({ shops: 10, rate: 9 })]);
  });

  test("zero shops starts at one shop with rate zero", () => {
    const result = outlook(0);
    expect(result.rows[0]).toEqual({
      shops: 1,
      rate: 0,
      remainingTaxExcluded: null,
      remainingTaxIncludedApprox: null,
      points: 0,
    });
    // One more shop (1 shop) does not reach the first tier, so there is no gain to show.
    expect(result.nextShop).toBeNull();
  });

  test("next shop means one more shop", () => {
    expect(outlook(1).nextShop).toEqual({ rateDelta: 1, pointsGain: 102 });
    const gapped = [
      { minShops: 2, rate: 1 },
      { minShops: 5, rate: 4 },
    ];
    expect(outlook(3, 7000, { tiers: gapped }).nextShop).toBeNull();
    expect(outlook(4, 7000, { tiers: gapped }).nextShop).toEqual({ rateDelta: 3, pointsGain: 306 });
  });

  test("tax-included basis does not convert the remaining amount", () => {
    const row = outlook(4, 7000, { amountBasis: "tax-included" }).rows[0];
    expect(row?.remainingTaxExcluded).toBe(223134);
    expect(row?.remainingTaxIncludedApprox).toBe(223134);
  });
});

describe("shopAroundOutlook in calculation results", () => {
  const shopIds = [1, 2, 3, 4].map((n) => `a0000000-0000-4000-8000-00000000000${n}`);
  const shops: Shop[] = shopIds.map((id) => ({
    id,
    channel: "rakuten-ichiba",
    name: "shop",
    tags: [],
    updatedAt: "2026-10-04T00:00:00Z",
  }));
  // 2,805 yen incl. 10% tax = 2,550 yen excl. tax, so four shops make 10,200 yen.
  const orders: Order[] = shopIds.map((shopId, index) => ({
    id: `0${index}000000-0000-4000-8000-000000000001`,
    shopId,
    date: "2026-10-05",
    lineItems: [
      {
        id: `1${index}000000-0000-4000-8000-000000000001`,
        name: "item",
        unitPrice: 2805,
        quantity: 1,
        taxRate: 0.1,
        discount: 0,
      },
    ],
    onHold: false,
    tags: [],
  }));
  const shopAround: Benefit = {
    id: BENEFIT_ID,
    kind: "shop-around",
    category: "campaign",
    label: "shop-around",
    enabled: true,
    amountBasis: "tax-excluded",
    capScope: "campaign",
    conditions: {},
    params: { tiers: TIERS, cap: 7000, roundingUnit: "item" },
  };
  const plan = (benefits: Benefit[]): Plan => ({
    id: "f0000000-0000-4000-8000-000000000001",
    name: "plan",
    period: { start: "2026-10-01", end: "2026-10-31" },
    benefits,
    orders,
    updatedAt: "2026-10-04T00:00:00Z",
  });

  test("uses the plan's shop count and receiving base", () => {
    expect(calculate(plan([shopAround]), shops).shopAroundOutlook).toMatchObject({
      benefitId: BENEFIT_ID,
      shopCount: 4,
      currentRate: 3,
      receivingBase: 10200,
      cap: 7000,
      nextShop: { rateDelta: 1, pointsGain: 102 },
    });
  });

  test("cap is what remains after other plans in the same cap group", () => {
    // The other plan buys 27,500 yen incl. tax (25,000 excl.) at each of the 4 shops:
    // 4 × floor(25,000 × 3%) = 3,000 raw points of the shared 7,000 cap.
    const otherOrders: Order[] = shopIds.map((shopId, index) => ({
      id: `0${index}000000-0000-4000-8000-000000000002`,
      shopId,
      date: "2026-10-05",
      lineItems: [
        {
          id: `1${index}000000-0000-4000-8000-000000000002`,
          name: "item",
          unitPrice: 27500,
          quantity: 1,
          taxRate: 0.1,
          discount: 0,
        },
      ],
      onHold: false,
      tags: [],
    }));
    const PLAN_ID = "f0000000-0000-4000-8000-000000000001";
    const shared = { ...shopAround, sharedKey: "marathon" };
    const otherPlan = (cap: number): Plan => ({
      ...plan([
        {
          ...shared,
          id: "5a000000-0000-4000-8000-000000000002",
          params: { ...shared.params, cap },
        },
      ]),
      id: "f0000000-0000-4000-8000-000000000002",
      orders: otherOrders,
    });
    const outlookFor = (otherCap: number) =>
      calculateAll([plan([shared]), otherPlan(otherCap)], shops).get(PLAN_ID)?.shopAroundOutlook;

    const result = outlookFor(7000);
    expect(result?.cap).toBe(4000);
    expect(result?.rows[0]?.remainingTaxExcluded).toBe(Math.ceil(400000 / 3) - 10200);
    // A smaller cap on the other copy wins (the group cap is the minimum): 6,000 − 3,000.
    expect(outlookFor(6000)?.cap).toBe(3000);
  });

  test("null when no shop-around benefit", () => {
    expect(calculate(plan([]), shops).shopAroundOutlook).toBeNull();
    const disabled = { ...shopAround, enabled: false };
    expect(calculate(plan([disabled]), shops).shopAroundOutlook).toBeNull();
  });
});
