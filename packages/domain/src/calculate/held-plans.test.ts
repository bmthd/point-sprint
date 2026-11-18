import { describe, expect, test } from "vitest";
import type { Benefit } from "#/model/benefit.ts";
import type { Order } from "#/model/order.ts";
import type { Plan } from "#/model/plan.ts";
import type { Shop } from "#/model/shop.ts";
import { calculateAll, totalCountedWith } from "./calculate.ts";
import type { CalculationResult } from "./types.ts";

const SHOP_1 = "a0000000-0000-4000-8000-000000000001";
const ACTIVE_ID = "f0000000-0000-4000-8000-000000000001";
const OTHER_ID = "f0000000-0000-4000-8000-000000000002";
const THIRD_ID = "f0000000-0000-4000-8000-000000000003";
const ORDER_ACTIVE = "0a000000-0000-4000-8000-000000000001";
const ORDER_OTHER = "0b000000-0000-4000-8000-000000000002";
const ORDER_THIRD = "0c000000-0000-4000-8000-000000000003";
const ITEM_ACTIVE = "1a000000-0000-4000-8000-000000000001";
const ITEM_OTHER = "1b000000-0000-4000-8000-000000000002";
const ITEM_THIRD = "1c000000-0000-4000-8000-000000000003";
const BONUS_ID = "5b000000-0000-4000-8000-000000000001";

const shops: Shop[] = [
  {
    id: SHOP_1,
    channel: "rakuten-ichiba",
    name: "shop",
    tags: [],
    updatedAt: "2026-10-04T00:00:00Z",
  },
];

/** 8,800 yen incl. tax = 8,000 yen excl. tax → 80 raw points at +1. */
const order = (id: string, itemId: string, date: string, over: Partial<Order> = {}): Order =>
  ({
    id,
    shopId: SHOP_1,
    date,
    lineItems: [
      { id: itemId, name: "item", unitPrice: 8800, quantity: 1, taxRate: 0.1, discount: 0 },
    ],
    onHold: false,
    tags: [],
    ...over,
  }) as Order;

/** +1 with a 100P cap shared by every plan of the account in the month. */
const sharedBonus: Benefit = {
  id: BONUS_ID,
  kind: "rate-bonus",
  category: "campaign",
  label: "bonus",
  enabled: true,
  amountBasis: "tax-excluded",
  capScope: "month",
  conditions: {},
  params: { rate: 1, cap: 100, roundingUnit: "item" },
};

const plan = (id: string, orders: Order[]): Plan => ({
  id,
  name: "plan",
  period: { start: "2026-10-01", end: "2026-10-31" },
  benefits: [sharedBonus],
  orders,
  updatedAt: "2026-10-04T00:00:00Z",
});

// The held plans' orders come first, so they would take the shared cap first if they were counted.
const active = plan(ACTIVE_ID, [order(ORDER_ACTIVE, ITEM_ACTIVE, "2026-10-05")]);
const other = plan(OTHER_ID, [order(ORDER_OTHER, ITEM_OTHER, "2026-10-03")]);
const third = plan(THIRD_ID, [order(ORDER_THIRD, ITEM_THIRD, "2026-10-04")]);

const sumOfTotals = (results: Map<string, CalculationResult>) =>
  [...results.values()].reduce((sum, result) => sum + result.total, 0);

describe("held plans", () => {
  test("a held plan is left out of the other plans' shared cap", () => {
    const results = calculateAll([active, { ...other, onHold: true }], shops);
    expect(results.get(active.id)?.total).toBe(calculateAll([active], shops).get(active.id)?.total);
    expect(results.get(active.id)?.total).toBe(80);
  });

  test("a held plan is calculated with every plan that is not held", () => {
    const results = calculateAll([active, { ...other, onHold: true }], shops);
    expect(results.get(other.id)?.total).toBe(
      calculateAll([active, other], shops).get(other.id)?.total,
    );
    expect(results.get(other.id)?.total).toBe(80);
  });

  test("held plans do not count each other", () => {
    const results = calculateAll(
      [active, { ...other, onHold: true }, { ...third, onHold: true }],
      shops,
    );
    expect(results.get(third.id)?.total).toBe(
      calculateAll([active, third], shops).get(third.id)?.total,
    );
    expect(results.get(third.id)?.total).toBe(80);
  });

  test("keeps the order of the plans given", () => {
    const results = calculateAll([{ ...other, onHold: true }, active], shops);
    expect([...results.keys()]).toEqual([OTHER_ID, ACTIVE_ID]);
  });

  test("a held order of a held plan is estimated with the plans that are not held", () => {
    const heldOrder = { ...other, orders: [{ ...other.orders[0]!, onHold: true }] } as Plan;
    const results = calculateAll(
      [active, { ...heldOrder, onHold: true }, { ...third, onHold: true }],
      shops,
    );
    const expected =
      sumOfTotals(calculateAll([active, other], shops)) -
      sumOfTotals(calculateAll([active, heldOrder], shops));
    expect(results.get(other.id)?.heldEstimates[0]?.points).toBe(expected);
    expect(expected).toBe(20);
  });

  test("totalCountedWith sums the plans counted with the given plan", () => {
    const plans = [active, { ...other, onHold: true }, { ...third, onHold: true }];
    const results = calculateAll(plans, shops);
    const t = (id: string) => results.get(id)?.total ?? 0;
    expect(totalCountedWith(results, plans, active.id)).toBe(t(active.id));
    expect(totalCountedWith(results, plans, other.id)).toBe(t(active.id) + t(other.id));
  });
});
