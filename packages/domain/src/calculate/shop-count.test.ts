import { describe, expect, test } from "vitest";
import type { LineItem, Order } from "../model/order";
import type { Shop } from "../model/shop";
import { countShops as countShopsIn } from "./shop-count";

const PERIOD = { start: "2026-10-01", end: "2026-10-07" };
const countShops = (orders: Order[], shops: Shop[]) => countShopsIn(orders, shops, PERIOD);

const SHOP_A = "11111111-1111-4111-8111-111111111111";
const SHOP_B = "22222222-2222-4222-8222-222222222222";
const SHOP_X = "99999999-9999-4999-8999-999999999999";

const shop = (id: string, channel: Shop["channel"] = "rakuten-ichiba"): Shop => ({
  id,
  channel,
  name: "shop",
  tags: [],
  updatedAt: "2026-10-04T00:00:00Z",
});

const item = (over: Partial<LineItem>): LineItem => ({
  id: "3f2b8c1e-5d4a-4e7b-9a10-1c2d3e4f5a6b",
  name: "item",
  unitPrice: 0,
  quantity: 1,
  taxRate: 0.1,
  discount: 0,
  ...over,
});

const order = (shopId: string, ...lineItems: LineItem[]): Order => ({
  id: "4a3b2c1d-5d4a-4e7b-9a10-1c2d3e4f5a6b",
  shopId,
  date: "2026-10-01",
  lineItems,
  onHold: false,
  tags: [],
});

describe("countShops", () => {
  test("999 yen is not counted, 1,000 yen is", () => {
    expect(countShops([order(SHOP_A, item({ unitPrice: 999 }))], [shop(SHOP_A)])).toBe(0);
    expect(countShops([order(SHOP_A, item({ unitPrice: 1000 }))], [shop(SHOP_A)])).toBe(1);
  });
  test("two orders at the same shop accumulate to one shop", () => {
    const orders = [
      order(SHOP_A, item({ unitPrice: 600 })),
      order(SHOP_A, item({ unitPrice: 400 })),
    ];
    expect(countShops(orders, [shop(SHOP_A)])).toBe(1);
  });
  test("two orders of 1,000 yen at the same shop count once", () => {
    const orders = [
      order(SHOP_A, item({ unitPrice: 1000 })),
      order(SHOP_A, item({ unitPrice: 1000 })),
    ];
    expect(countShops(orders, [shop(SHOP_A)])).toBe(1);
  });
  test("Rakuma counts as a shop", () => {
    const orders = [
      order(SHOP_A, item({ unitPrice: 1000 })),
      order(SHOP_B, item({ unitPrice: 1000 })),
    ];
    expect(countShops(orders, [shop(SHOP_A), shop(SHOP_B, "rakuma")])).toBe(2);
  });
  test("discount is subtracted before the threshold", () => {
    const orders = [order(SHOP_A, item({ unitPrice: 1100, discount: 200 }))];
    expect(countShops(orders, [shop(SHOP_A)])).toBe(0);
  });
  test("unknown shop is ignored", () => {
    expect(countShops([order(SHOP_X, item({ unitPrice: 5000 }))], [shop(SHOP_A)])).toBe(0);
  });
  test("order outside the period is not counted", () => {
    const outside = { ...order(SHOP_A, item({ unitPrice: 1000 })), date: "2026-09-30" };
    expect(countShops([outside], [shop(SHOP_A)])).toBe(0);
    const after = { ...order(SHOP_A, item({ unitPrice: 1000 })), date: "2026-10-08" };
    expect(countShops([after], [shop(SHOP_A)])).toBe(0);
    const edge = { ...order(SHOP_A, item({ unitPrice: 1000 })), date: "2026-10-07" };
    expect(countShops([edge], [shop(SHOP_A)])).toBe(1);
  });
});
