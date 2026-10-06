import { describe, expect, test } from "vitest";
import type { Benefit } from "../model/benefit";
import type { Order } from "../model/order";
import type { Plan } from "../model/plan";
import type { Shop } from "../model/shop";
import { calculate, calculateAll } from "./calculate";

const SHOP_1 = "a0000000-0000-4000-8000-000000000001";
const SHOP_2 = "a0000000-0000-4000-8000-000000000002";
const UNKNOWN_SHOP = "a0000000-0000-4000-8000-000000000009";
const PLAN_ID = "f0000000-0000-4000-8000-000000000001";
const ORDER_A = "0a000000-0000-4000-8000-000000000001";
const ORDER_B = "0b000000-0000-4000-8000-000000000002";
const ITEM_A = "1a000000-0000-4000-8000-000000000001";
const ITEM_B = "1b000000-0000-4000-8000-000000000002";
const BASE_ID = "5b000000-0000-4000-8000-000000000001";
const CAPPED_ID = "5c000000-0000-4000-8000-000000000002";
const SHOP_AROUND_ID = "5d000000-0000-4000-8000-000000000003";

const shop = (id: string): Shop => ({
  id,
  channel: "rakuten-ichiba",
  name: "shop",
  tags: [],
  updatedAt: "2026-10-04T00:00:00Z",
});
const shops = [shop(SHOP_1), shop(SHOP_2)];

/** 1,100 yen incl. tax = 1,000 yen excl. tax → 10 points at +1. */
const order = (id: string, itemId: string, shopId: string, over: Partial<Order> = {}): Order => ({
  id,
  shopId,
  date: "2026-10-05",
  lineItems: [
    { id: itemId, name: "item", unitPrice: 1100, quantity: 1, taxRate: 0.1, discount: 0 },
  ],
  onHold: false,
  tags: [],
  ...over,
});

const bonus = (id: string, cap?: number): Benefit => ({
  id,
  kind: "rate-bonus",
  category: "base",
  label: "bonus",
  enabled: true,
  amountBasis: "tax-excluded",
  capScope: "plan",
  conditions: {},
  params:
    cap === undefined ? { rate: 1, roundingUnit: "item" } : { rate: 1, cap, roundingUnit: "item" },
});

const shopAround: Benefit = {
  id: SHOP_AROUND_ID,
  kind: "shop-around",
  category: "campaign",
  label: "shop-around",
  enabled: true,
  amountBasis: "tax-excluded",
  capScope: "plan",
  conditions: {},
  params: { tiers: [{ minShops: 2, rate: 1 }], roundingUnit: "item" },
};

const plan = (orders: Order[], benefits: Benefit[]): Plan => ({
  id: PLAN_ID,
  name: "plan",
  period: { start: "2026-10-01", end: "2026-10-31" },
  benefits,
  orders,
  updatedAt: "2026-10-04T00:00:00Z",
});

describe("held orders", () => {
  test("held order is excluded from shop count and totals", () => {
    const result = calculate(
      plan(
        [order(ORDER_A, ITEM_A, SHOP_1), order(ORDER_B, ITEM_B, SHOP_2, { onHold: true })],
        [bonus(BASE_ID), shopAround],
      ),
      shops,
    );
    expect(result.shopCount).toBe(1);
    expect(result.breakdown.some((row) => row.lineItemId === ITEM_B)).toBe(false);
    expect(result.total).toBe(10);
  });

  test("held order raises no period or unknown-shop warnings", () => {
    const result = calculate(
      plan(
        [
          order(ORDER_A, ITEM_A, SHOP_1),
          order(ORDER_B, ITEM_B, UNKNOWN_SHOP, { onHold: true, date: "2026-11-30" }),
        ],
        [bonus(BASE_ID)],
      ),
      shops,
    );
    expect(result.warnings).toEqual([]);
  });

  test("held estimate is the total increase when unheld", () => {
    const benefits = [bonus(BASE_ID), shopAround];
    const held = calculate(
      plan(
        [order(ORDER_A, ITEM_A, SHOP_1), order(ORDER_B, ITEM_B, SHOP_2, { onHold: true })],
        benefits,
      ),
      shops,
    );
    const unheld = calculate(
      plan([order(ORDER_A, ITEM_A, SHOP_1), order(ORDER_B, ITEM_B, SHOP_2)], benefits),
      shops,
    );
    // Unheld: base 10 + 10 and shop-around (2 shops, +1) 10 + 10 = 40. Held: base 10.
    expect(unheld.total).toBe(40);
    expect(held.heldEstimates).toEqual([{ orderId: ORDER_B, points: unheld.total - held.total }]);
    expect(held.heldEstimates[0]?.points).toBe(30);
    expect(unheld.heldEstimates).toEqual([]);
  });

  test("held estimate respects caps", () => {
    // The capped benefit already reaches its cap of 10 with order A alone.
    const result = calculate(
      plan(
        [order(ORDER_A, ITEM_A, SHOP_1), order(ORDER_B, ITEM_B, SHOP_1, { onHold: true })],
        [bonus(BASE_ID), bonus(CAPPED_ID, 10)],
      ),
      shops,
    );
    expect(result.total).toBe(20);
    expect(result.benefitTotals.find((t) => t.benefitId === CAPPED_ID)?.capReached).toBe(true);
    expect(result.heldEstimates).toEqual([{ orderId: ORDER_B, points: 10 }]);
  });
});

test("held estimate is the net increase across plans sharing a cap", () => {
  const PLAN_2 = "f0000000-0000-4000-8000-000000000002";
  const ORDER_C = "0c000000-0000-4000-8000-000000000003";
  const ITEM_C = "1c000000-0000-4000-8000-000000000003";
  // Both plans hold a copy of a benefit sharing a monthly cap of 10 points.
  const shared = (id: string): Benefit => ({
    ...bonus(id, 10),
    capScope: "month",
    sharedKey: "shared",
  });
  const plan1: Plan = {
    ...plan([order(ORDER_A, ITEM_A, SHOP_1, { onHold: true })], [shared(BASE_ID)]),
  };
  const plan2: Plan = {
    ...plan([order(ORDER_C, ITEM_C, SHOP_1)], [shared(CAPPED_ID)]),
    id: PLAN_2,
  };
  const results = calculateAll([plan1, plan2], shops);
  // Plan 2 already fills the cap; releasing order A from hold only splits the same 10 points 5/5.
  expect(results.get(PLAN_2)?.total).toBe(10);
  expect(results.get(PLAN_ID)?.heldEstimates).toEqual([{ orderId: ORDER_A, points: 0 }]);
});
