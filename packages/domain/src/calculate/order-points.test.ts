import { expect, test } from "vitest";
import type { Order } from "#/model/order.ts";
import { orderPoints } from "./order-points.ts";
import type { BreakdownRow } from "./types.ts";

const order: Order = {
  id: "order",
  channel: "rakuten-books",
  shopTags: [],
  date: "2026-11-22",
  onHold: false,
  tags: [],
  lineItems: [{ id: "item", name: "book", unitPrice: 3000, quantity: 1, taxRate: 0, discount: 0 }],
};
const rows: BreakdownRow[] = [
  { lineItemId: "item", source: "shop-rate", points: 30 },
  { lineItemId: "other", source: "shop-rate", points: 90 },
  { lineItemId: "item", source: "bonus", points: 10, rawPoints: 20 },
];

test("sums the capped points for this order's items across sources", () => {
  const before = structuredClone(rows);
  expect(orderPoints(order, rows)).toEqual({ rows: [rows[0], rows[2]], total: 40 });
  expect(rows).toEqual(before);
});

test("missing orders and empty calculations have no points", () => {
  expect(orderPoints(undefined, rows)).toEqual({ rows: [], total: 0 });
  expect(orderPoints(order, [])).toEqual({ rows: [], total: 0 });
});
