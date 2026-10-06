import { describe, expect, test } from "vitest";
import type { Benefit } from "../model/benefit";
import type { LineItem, Order } from "../model/order";
import type { Plan } from "../model/plan";
import type { Shop } from "../model/shop";
import { calculate } from "./calculate";
import type { CalculationResult } from "./types";

const SHOP_A = "a0000000-0000-4000-8000-000000000001";
const SHOP_B = "b0000000-0000-4000-8000-000000000002";
const SHOP_C = "c0000000-0000-4000-8000-000000000003";
const SHOP_R = "d0000000-0000-4000-8000-000000000004";
const SHOP_UNKNOWN = "e0000000-0000-4000-8000-000000000005";

const ITEM_1 = "10000000-0000-4000-8000-000000000001";
const ITEM_2 = "20000000-0000-4000-8000-000000000002";
const ITEM_3 = "30000000-0000-4000-8000-000000000003";

const ORDER_1 = "01000000-0000-4000-8000-000000000001";
const ORDER_2 = "02000000-0000-4000-8000-000000000002";
const ORDER_3 = "03000000-0000-4000-8000-000000000003";

const SPU_BASE_ID = "5b000000-0000-4000-8000-000000000001";
const SHOP_AROUND_ID = "5a000000-0000-4000-8000-000000000002";

const shop = (id: string, channel: Shop["channel"]): Shop => ({
  id,
  channel,
  name: "shop",
  tags: [],
  updatedAt: "2026-10-04T00:00:00Z",
});

const shops: Shop[] = [
  shop(SHOP_A, "rakuten-ichiba"),
  shop(SHOP_B, "rakuten-ichiba"),
  shop(SHOP_C, "rakuten-ichiba"),
  shop(SHOP_R, "rakuma"),
];

const item = (id: string, unitPrice: number, over: Partial<LineItem> = {}): LineItem => ({
  id,
  name: "item",
  unitPrice,
  quantity: 1,
  taxRate: 0.1,
  discount: 0,
  ...over,
});

const order = (id: string, shopId: string, lineItems: LineItem[], date = "2026-10-05"): Order => ({
  id,
  shopId,
  date,
  lineItems,
  onHold: false,
  tags: [],
});

const spuBase: Benefit = {
  id: SPU_BASE_ID,
  kind: "rate-bonus",
  category: "spu",
  label: "通常ポイント",
  enabled: true,
  amountBasis: "tax-excluded",
  capScope: "plan",
  conditions: {},
  params: { rate: 1, roundingUnit: "item" },
};

const tiers = [2, 3, 4, 5, 6, 7, 8, 9, 10].map((minShops) => ({
  minShops,
  rate: minShops - 1,
}));

const shopAround = (cap = 7000): Benefit => ({
  id: SHOP_AROUND_ID,
  kind: "shop-around",
  category: "campaign",
  label: "買いまわり",
  enabled: true,
  amountBasis: "tax-excluded",
  capScope: "plan",
  conditions: {},
  params: { tiers, cap, roundingUnit: "item" },
});

const plan = (orders: Order[], benefits: Benefit[] = [spuBase, shopAround()]): Plan => ({
  id: "f0000000-0000-4000-8000-000000000001",
  name: "plan",
  period: { start: "2026-10-04", end: "2026-10-11" },
  benefits,
  orders,
  updatedAt: "2026-10-04T00:00:00Z",
});

const rowsOf = (result: CalculationResult, source: string) =>
  result.breakdown.filter((row) => row.source === source);

const totalOf = (result: CalculationResult, benefitId: string) =>
  result.benefitTotals.find((t) => t.benefitId === benefitId);

function expectBreakdownSumsToTotal(result: CalculationResult) {
  expect(result.total).toBe(result.breakdown.reduce((sum, row) => sum + row.points, 0));
}

describe("calculate", () => {
  test("base points only", () => {
    const result = calculate(plan([order(ORDER_1, SHOP_A, [item(ITEM_1, 3300)])]), shops);
    expect(result.total).toBe(30);
    expect(result.breakdown).toEqual([{ lineItemId: ITEM_1, source: SPU_BASE_ID, points: 30 }]);
    expect(result.shopCount).toBe(1);
    expect(result.warnings).toEqual([]);
    expectBreakdownSumsToTotal(result);
  });

  test("shop-around applies to all receiving orders", () => {
    const result = calculate(
      plan([
        order(ORDER_1, SHOP_A, [item(ITEM_1, 1100)]),
        order(ORDER_2, SHOP_B, [item(ITEM_2, 1100)]),
      ]),
      shops,
    );
    expect(result.shopCount).toBe(2);
    expect(rowsOf(result, SHOP_AROUND_ID)).toEqual([
      { lineItemId: ITEM_1, source: SHOP_AROUND_ID, points: 10 },
      { lineItemId: ITEM_2, source: SHOP_AROUND_ID, points: 10 },
    ]);
    expect(totalOf(result, SHOP_AROUND_ID)).toEqual({
      benefitId: SHOP_AROUND_ID,
      rawPoints: 20,
      cappedPoints: 20,
      capReached: false,
    });
    expect(result.total).toBe(40);
    expectBreakdownSumsToTotal(result);
  });

  test("Rakuma counts but does not receive shop-around", () => {
    const result = calculate(
      plan([
        order(ORDER_1, SHOP_A, [item(ITEM_1, 1100)]),
        order(ORDER_2, SHOP_R, [item(ITEM_2, 1100)]),
      ]),
      shops,
    );
    expect(result.shopCount).toBe(2);
    expect(rowsOf(result, SHOP_AROUND_ID)).toEqual([
      { lineItemId: ITEM_1, source: SHOP_AROUND_ID, points: 10 },
    ]);
    expectBreakdownSumsToTotal(result);
  });

  test("cap is applied and allocated proportionally", () => {
    const result = calculate(
      plan(
        [
          order(ORDER_1, SHOP_A, [item(ITEM_1, 1100)]),
          order(ORDER_2, SHOP_B, [item(ITEM_2, 1100)]),
        ],
        [spuBase, shopAround(15)],
      ),
      shops,
    );
    expect(totalOf(result, SHOP_AROUND_ID)).toEqual({
      benefitId: SHOP_AROUND_ID,
      rawPoints: 20,
      cappedPoints: 15,
      capReached: true,
    });
    expect(rowsOf(result, SHOP_AROUND_ID)).toEqual([
      { lineItemId: ITEM_1, source: SHOP_AROUND_ID, points: 8 },
      { lineItemId: ITEM_2, source: SHOP_AROUND_ID, points: 7 },
    ]);
    expectBreakdownSumsToTotal(result);
  });

  test("order of orders does not change the result", () => {
    // 3 shops → +2: each item has 20 raw points; cap 10 splits into 3.33… each (tied remainders).
    const orders = [
      order(ORDER_1, SHOP_A, [item(ITEM_1, 1100)]),
      order(ORDER_2, SHOP_B, [item(ITEM_2, 1100)]),
      order(ORDER_3, SHOP_C, [item(ITEM_3, 1100)]),
    ];
    const benefits = [spuBase, shopAround(10)];
    const forward = calculate(plan(orders, benefits), shops);
    const reversed = calculate(plan([...orders].reverse(), benefits), shops);
    const sorted = (result: CalculationResult) =>
      [...result.breakdown].sort(
        (a, b) => a.lineItemId.localeCompare(b.lineItemId) || a.source.localeCompare(b.source),
      );
    expect(reversed.total).toBe(forward.total);
    expect(sorted(reversed)).toEqual(sorted(forward));
    expect(rowsOf(forward, SHOP_AROUND_ID).map((row) => row.points)).toEqual([4, 3, 3]);
    expectBreakdownSumsToTotal(forward);
    expectBreakdownSumsToTotal(reversed);
  });

  test("disabled benefits are ignored", () => {
    const result = calculate(
      plan(
        [
          order(ORDER_1, SHOP_A, [item(ITEM_1, 1100)]),
          order(ORDER_2, SHOP_B, [item(ITEM_2, 1100)]),
        ],
        [spuBase, { ...shopAround(), enabled: false }],
      ),
      shops,
    );
    expect(result.benefitTotals.map((t) => t.benefitId)).toEqual([SPU_BASE_ID]);
    expect(rowsOf(result, SHOP_AROUND_ID)).toEqual([]);
    expect(result.total).toBe(20);
    expectBreakdownSumsToTotal(result);
  });

  test("unknown shop yields a warning and is excluded from shop-around", () => {
    const result = calculate(
      plan([
        order(ORDER_1, SHOP_A, [item(ITEM_1, 1100)]),
        order(ORDER_2, SHOP_B, [item(ITEM_2, 1100)]),
        order(ORDER_3, SHOP_UNKNOWN, [item(ITEM_3, 5000)]),
      ]),
      shops,
    );
    expect(result.warnings).toEqual([{ type: "unknown-shop", orderId: ORDER_3 }]);
    expect(result.shopCount).toBe(2);
    // 5,000 yen incl. tax → 4,546 yen excl. tax → 45 points.
    expect(rowsOf(result, SPU_BASE_ID)).toContainEqual({
      lineItemId: ITEM_3,
      source: SPU_BASE_ID,
      points: 45,
    });
    expect(rowsOf(result, SHOP_AROUND_ID).map((row) => row.lineItemId)).toEqual([ITEM_1, ITEM_2]);
    expectBreakdownSumsToTotal(result);
  });

  test("unknown shop is excluded from benefits restricted by channel", () => {
    const ichibaOnly: Benefit = {
      ...spuBase,
      id: "5c000000-0000-4000-8000-000000000003",
      conditions: { channels: ["rakuten-ichiba"] },
    };
    const result = calculate(
      plan([order(ORDER_1, SHOP_UNKNOWN, [item(ITEM_1, 1100)])], [ichibaOnly]),
      shops,
    );
    expect(result.breakdown).toEqual([]);
    expect(result.total).toBe(0);
    expectBreakdownSumsToTotal(result);
  });

  test("shop point rate adds a shop-rate row", () => {
    const result = calculate(
      plan([order(ORDER_1, SHOP_A, [item(ITEM_1, 1100, { shopPointRate: 3 })])]),
      shops,
    );
    expect(rowsOf(result, "shop-rate")).toEqual([
      { lineItemId: ITEM_1, source: "shop-rate", points: 20 },
    ]);
    expect(result.breakdown.at(-1)?.source).toBe("shop-rate");
    expect(result.total).toBe(30);
    expectBreakdownSumsToTotal(result);
  });

  test("out-of-period orders do not inflate the shop count", () => {
    const result = calculate(
      plan([
        order(ORDER_1, SHOP_A, [item(ITEM_1, 1100)]),
        order(ORDER_2, SHOP_B, [item(ITEM_2, 1100)], "2026-10-12"),
      ]),
      shops,
    );
    expect(result.shopCount).toBe(1);
    expect(rowsOf(result, SHOP_AROUND_ID).filter((r) => r.lineItemId === ITEM_1)).toEqual([]);
  });

  test("order outside the plan period yields a warning", () => {
    const result = calculate(
      plan([order(ORDER_1, SHOP_A, [item(ITEM_1, 3300)], "2026-10-12")]),
      shops,
    );
    expect(result.warnings).toEqual([{ type: "order-outside-period", orderId: ORDER_1 }]);
    expect(result.total).toBe(30);
    expectBreakdownSumsToTotal(result);
  });
});
