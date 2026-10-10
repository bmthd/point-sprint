import { describe, expect, test } from "vitest";
import type { Benefit } from "../model/benefit";
import type { LineItem, Order } from "../model/order";
import type { Plan } from "../model/plan";
import type { Shop } from "../model/shop";
import { capFlows } from "./cap-flows";

const SHOP_A = "a0000000-0000-4000-8000-000000000001";
const SHOP_B = "b0000000-0000-4000-8000-000000000002";
const PLAN = "f0000000-0000-4000-8000-000000000001";
const OTHER = "f0000000-0000-4000-8000-000000000002";

const shop = (id: string, over: Partial<Shop> = {}): Shop => ({
  id,
  channel: "rakuten-ichiba",
  name: "shop",
  tags: [],
  updatedAt: "2026-10-04T00:00:00Z",
  ...over,
});
const shops = [shop(SHOP_A), shop(SHOP_B)];

/** +1倍, at most 100P a month, shared between the plans. */
const card: Benefit = {
  id: "5b000000-0000-4000-8000-000000000001",
  kind: "rate-bonus",
  category: "spu",
  label: "楽天カード特典分",
  enabled: true,
  conditions: {},
  amountBasis: "tax-excluded",
  capScope: "month",
  sharedKey: "card",
  params: { rate: 1, roundingUnit: "item", cap: 100 },
};

/** +1倍 from 1 shop, +2倍 from 2, at most 300P in the plan. */
const shopAround: Benefit = {
  id: "5a000000-0000-4000-8000-000000000002",
  kind: "shop-around",
  category: "campaign",
  label: "買いまわり",
  enabled: true,
  conditions: {},
  amountBasis: "tax-excluded",
  capScope: "plan",
  params: {
    tiers: [
      { minShops: 1, rate: 1 },
      { minShops: 2, rate: 2 },
    ],
    roundingUnit: "item",
    cap: 300,
  },
};

const item = (id: string, unitPrice: number): LineItem => ({
  id,
  name: "",
  unitPrice,
  quantity: 1,
  taxRate: 0.1,
  discount: 0,
});

let serial = 0;
/** An order of one ¥`price` item at 10% (¥11,000 earns 100P at +1倍). */
const order = (date: string, price: number, shopId = SHOP_A, items?: LineItem[]): Order => {
  serial += 1;
  const n = String(serial).padStart(2, "0");
  return {
    id: `0${n}00000-0000-4000-8000-000000000000`,
    shopId,
    date,
    lineItems: items ?? [item(`1${n}00000-0000-4000-8000-000000000000`, price)],
    onHold: false,
    tags: [],
  };
};

const plan = (id: string, orders: Order[], benefits: Benefit[] = [card]): Plan => ({
  id,
  name: id,
  period: { start: "2026-10-04", end: "2026-10-09" },
  benefits,
  orders,
  updatedAt: "2026-10-04T00:00:00Z",
});

const flowsOf = (plans: Plan[], draft: Order, withShops = shops) =>
  capFlows({ plans, shops: withShops, planId: PLAN, order: draft });

describe("capFlows", () => {
  test("points into the cap and over it, and the price that fills it", () => {
    // Another plan used 30P (¥3,300). ¥11,000 earns 100P: 70P fit, 30P are over.
    const plans = [plan(OTHER, [order("2026-10-05", 3300)]), plan(PLAN, [])];
    expect(flowsOf(plans, order("2026-10-06", 11000))).toEqual([
      expect.objectContaining({ points: 100, into: 70, over: 30, fillPrice: 7699 }),
    ]);
  });

  test("an order of the same day as another shares the cap with it", () => {
    // Both earn 100P on 10/5 and split the 100P cap.
    const plans = [plan(PLAN, [order("2026-10-05", 11000)])];
    expect(flowsOf(plans, order("2026-10-05", 11000, SHOP_B))).toEqual([
      expect.objectContaining({ points: 100, into: 50, over: 50, fillPrice: null }),
    ]);
  });

  test("an order dated before the others gets the cap first", () => {
    const plans = [plan(PLAN, [order("2026-10-06", 11000)])];
    expect(flowsOf(plans, order("2026-10-05", 11000, SHOP_B))).toEqual([
      expect.objectContaining({ points: 100, into: 100, over: 0 }),
    ]);
  });

  test("a line of another month, or whose conditions the order misses, takes nothing", () => {
    const plans = [plan(PLAN, [])];
    expect(flowsOf(plans, order("2026-11-05", 11000))).toEqual([]);
    const only39 = [plan(PLAN, [], [{ ...card, conditions: { shopTags: ["39shop"] } }])];
    expect(flowsOf(only39, order("2026-10-05", 11000))).toEqual([]);
  });

  test("a shop-around cap takes nothing from a channel that does not receive it", () => {
    const plans = [plan(PLAN, [], [shopAround])];
    const rakuma = [shop(SHOP_A, { channel: "rakuma" })];
    expect(flowsOf(plans, order("2026-10-05", 11000))).toHaveLength(1);
    expect(flowsOf(plans, order("2026-10-05", 11000), rakuma)).toEqual([]);
  });

  test("an order from a new shop is priced at the rate that shop gives", () => {
    // With a second shop the first order earns 200P at +2倍, which leaves 100P of 300P.
    const plans = [plan(PLAN, [order("2026-10-05", 11000)], [shopAround])];
    expect(flowsOf(plans, order("2026-10-06", 11000, SHOP_B))).toEqual([
      expect.objectContaining({ points: 200, into: 100, over: 100, fillPrice: 5499 }),
    ]);
  });

  test("an order of several items has no fill price", () => {
    const two = order("2026-10-05", 0, SHOP_A, [
      item("x0000000-0000-4000-8000-000000000001", 1100),
      item("x0000000-0000-4000-8000-000000000002", 1100),
    ]);
    expect(flowsOf([plan(PLAN, [])], two)).toEqual([
      expect.objectContaining({ points: 20, into: 20, fillPrice: null }),
    ]);
  });
});
