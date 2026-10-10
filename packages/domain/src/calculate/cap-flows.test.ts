import { describe, expect, test } from "vitest";
import type { Benefit } from "../model/benefit";
import type { LineItem, Order } from "../model/order";
import type { Shop } from "../model/shop";
import { capFlows } from "./cap-flows";
import type { CapLine } from "./cap-lines";

const SHOP = "a0000000-0000-4000-8000-000000000001";

const shop: Shop = {
  id: SHOP,
  channel: "rakuten-ichiba",
  name: "shop",
  tags: [],
  updatedAt: "2026-10-04T00:00:00Z",
};

/** +1倍, at most 100P a month. */
const card: Benefit = {
  id: "5b000000-0000-4000-8000-000000000001",
  kind: "rate-bonus",
  category: "spu",
  label: "楽天カード特典分",
  enabled: true,
  conditions: {},
  amountBasis: "tax-excluded",
  capScope: "month",
  params: { rate: 1, roundingUnit: "item", cap: 100 },
};

const marathon: Benefit = {
  id: "5a000000-0000-4000-8000-000000000002",
  kind: "shop-around",
  category: "campaign",
  label: "お買い物マラソン",
  enabled: true,
  conditions: {},
  amountBasis: "tax-excluded",
  capScope: "plan",
  params: { tiers: [{ minShops: 1, rate: 1 }], roundingUnit: "item", cap: 100 },
};

/** October's card cap: other plans used 30P, and the order adds 100P (`raw` includes it). */
const line = (over: Partial<CapLine> = {}): CapLine => ({
  benefit: card,
  key: "month:default:card:2026-10",
  scope: "month",
  period: "2026-10",
  cap: 100,
  usedHere: 0,
  usedElsewhere: 30,
  sharedWith: [],
  raw: 130,
  remaining: 0,
  rate: 1,
  ...over,
});

const item = (id: string, unitPrice: number): LineItem => ({
  id,
  name: "",
  unitPrice,
  quantity: 1,
  taxRate: 0.1,
  discount: 0,
});

const order = (date: string, lineItems: LineItem[]): Order => ({
  id: "01000000-0000-4000-8000-000000000001",
  shopId: SHOP,
  date,
  lineItems,
  onHold: false,
  tags: [],
});

const ITEM_1 = "10000000-0000-4000-8000-000000000001";
const ITEM_2 = "20000000-0000-4000-8000-000000000002";

describe("capFlows", () => {
  test("points into the cap and over it, and the price that fills it", () => {
    // ¥11,000 at 10% → ¥10,000 before tax → 100P: 70P fit, 30P are over.
    const flows = capFlows({
      lines: [line()],
      order: order("2026-10-05", [item(ITEM_1, 11000)]),
      shop,
    });
    expect(flows).toEqual([
      expect.objectContaining({ points: 100, into: 70, over: 30, fillPrice: 7699 }),
    ]);
  });

  test("a full cap takes nothing and has no fill price", () => {
    const flows = capFlows({
      lines: [line({ raw: 200 })],
      order: order("2026-10-05", [item(ITEM_1, 11000)]),
      shop,
    });
    expect(flows).toEqual([
      expect.objectContaining({ points: 100, into: 0, over: 100, fillPrice: null }),
    ]);
  });

  test("a line of another month, or whose conditions the order misses, takes nothing", () => {
    const october = order("2026-10-05", [item(ITEM_1, 11000)]);
    expect(capFlows({ lines: [line({ period: "2026-11" })], order: october, shop })).toEqual([]);
    const only39 = line({ benefit: { ...card, conditions: { shopTags: ["39shop"] } } });
    expect(capFlows({ lines: [only39], order: october, shop })).toEqual([]);
  });

  test("a shop-around cap takes nothing from a channel that does not receive it", () => {
    const shopAround = line({ benefit: marathon, scope: "plan", period: null });
    const october = order("2026-10-05", [item(ITEM_1, 11000)]);
    expect(capFlows({ lines: [shopAround], order: october, shop })).toHaveLength(1);
    expect(
      capFlows({ lines: [shopAround], order: october, shop: { ...shop, channel: "rakuma" } }),
    ).toEqual([]);
  });

  test("an order of several items has no fill price", () => {
    const two = order("2026-10-05", [item(ITEM_1, 1100), item(ITEM_2, 1100)]);
    expect(capFlows({ lines: [line({ raw: 50, remaining: 50 })], order: two, shop })).toEqual([
      expect.objectContaining({ points: 20, into: 20, fillPrice: null }),
    ]);
  });
});
