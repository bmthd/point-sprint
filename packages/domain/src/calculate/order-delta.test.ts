import { expect, test } from "vitest";
import type { Benefit } from "#/model/benefit.ts";
import type { Order } from "#/model/order.ts";
import type { Plan } from "#/model/plan.ts";
import type { Shop } from "#/model/shop.ts";
import { addOrder, updateOrder } from "#/plan-ops/order-ops.ts";
import { calculateAll } from "./calculate.ts";
import { orderDelta } from "./order-delta.ts";

const shops: Shop[] = ["a", "b"].map((id) => ({
  id,
  name: id,
  channel: "rakuten-ichiba",
  tags: [],
  updatedAt: "2026-11-21T00:00:00Z",
}));
function order(id: string, shopId: string, price = 10000, date = "2026-11-23"): Order {
  return {
    id,
    shopId,
    date,
    onHold: false,
    tags: [],
    lineItems: [
      { id: `${id}-item`, name: "商品", unitPrice: price, quantity: 1, taxRate: 0.1, discount: 0 },
    ],
  };
}
function plan(cap = 7000): Plan {
  const common = {
    enabled: true,
    amountBasis: "tax-excluded",
    capScope: "plan",
    conditions: { dateRule: { type: "range", start: "2026-11-19", end: "2026-11-25" } },
  } as const;
  const benefits: Benefit[] = [
    {
      ...common,
      id: "base",
      label: "通常",
      kind: "rate-bonus",
      category: "spu",
      params: { rate: 1, roundingUnit: "item" },
    },
    {
      ...common,
      id: "around",
      label: "買いまわり",
      kind: "shop-around",
      category: "campaign",
      params: { cap, roundingUnit: "item", tiers: [{ minShops: 2, rate: 1 }] },
    },
  ];
  return {
    id: "plan",
    name: "ブラックフライデー",
    period: { start: "2026-11-19", end: "2026-11-25" },
    benefits,
    orders: [order("a", "a", 10000, "2026-11-21")],
    updatedAt: "2026-11-21T00:00:00Z",
  };
}
for (const [name, cap, draft, edit, expected] of [
  ["新店舗の遡及分", 7000, order("b", "b"), false, 270],
  ["同じ店舗", 7000, order("b", "a"), false, 90],
  ["上限に到達", 100, order("b", "b"), false, 190],
  ["上限を超過", 0, order("b", "b"), false, 90],
  ["保留で追加", 7000, { ...order("b", "b"), onHold: true }, false, 0],
  ["保留に変更", 7000, { ...order("a", "a"), onHold: true }, true, -90],
  ["金額の編集", 7000, order("a", "a", 20000), true, 91],
  ["期間外への日付変更", 7000, order("a", "a", 10000, "2026-11-26"), true, -90],
] as const) {
  test(`${name}: プレビューと確定前後の合計差が一致する`, () => {
    const before = plan(cap);
    const original = edit ? before.orders[0] : undefined;
    const after = edit ? updateOrder(before, draft) : addOrder(before, draft);
    const resultsBefore = calculateAll([before], shops);
    const resultsAfter = calculateAll([after], shops);
    const preview = orderDelta({
      before: resultsBefore.get(before.id),
      after: resultsAfter.get(after.id),
      order: draft,
      original,
    });
    expect(preview.total).toBe(expected);
    expect(preview.total).toBe(
      (resultsAfter.get(after.id)?.total ?? 0) - (resultsBefore.get(before.id)?.total ?? 0),
    );
    expect(preview.orderGain + preview.othersGain).toBe(preview.total);
    if (edit) expect(preview.othersGain).toBe(0);
    if (name === "新店舗の遡及分") expect(preview.othersGain).toBe(90);
  });
}
