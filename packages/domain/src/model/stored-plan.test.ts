import * as v from "valibot";
import { describe, expect, test } from "vitest";
import type { Order } from "./order";
import type { Plan } from "./plan";
import { OrderRowSchema, joinPlan, splitPlan } from "./stored-plan";

const PLAN_ID = "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f7a";
const SHOP_ID = "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b";
const EARLIER = "2026-10-04T00:00:00.000Z";
const LATER = "2026-10-05T00:00:00.000Z";

const order = (n: number, unitPrice = 1000): Order => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  date: "2026-10-10",
  lineItems: [
    {
      id: `10000000-0000-4000-8000-00000000000${n}`,
      name: `item ${n}`,
      unitPrice,
      quantity: 1,
      taxRate: 0.1,
      discount: 0,
    },
  ],
  onHold: false,
  tags: [],
  shopId: SHOP_ID,
});

const plan = (orders: Order[], updatedAt = EARLIER): Plan => ({
  id: PLAN_ID,
  name: "plan",
  period: { start: "2026-10-01", end: "2026-10-31" },
  benefits: [],
  orders,
  updatedAt,
});

describe("splitPlan", () => {
  test("a new plan writes its row and every order, with its updatedAt", () => {
    const split = splitPlan(plan([order(1), order(2)]), { orders: [] });
    expect(split.row).toEqual({ ...plan([]), orders: undefined, updatedAt: EARLIER });
    expect(split.orders.map((row) => [row.id, row.planId, row.updatedAt])).toEqual([
      [order(1).id, PLAN_ID, EARLIER],
      [order(2).id, PLAN_ID, EARLIER],
    ]);
    for (const row of split.orders) expect(v.safeParse(OrderRowSchema, row).success).toBe(true);
  });

  test("leaves out the rows that did not change", () => {
    const first = splitPlan(plan([order(1), order(2)]), { orders: [] });
    const again = splitPlan(plan([order(1), order(2)], LATER), {
      row: first.row,
      orders: first.orders,
    });
    expect(again).toEqual({ row: undefined, orders: [], removedOrderIds: [] });
  });

  test("an edited order is the only row written, with the plan's new updatedAt", () => {
    const first = splitPlan(plan([order(1), order(2)]), { orders: [] });
    const again = splitPlan(plan([order(1), order(2, 2000)], LATER), {
      row: first.row,
      orders: first.orders,
    });
    expect(again.row).toBeUndefined();
    expect(again.orders.map((row) => [row.id, row.updatedAt])).toEqual([[order(2).id, LATER]]);
  });

  test("a renamed plan writes its row only", () => {
    const first = splitPlan(plan([order(1)]), { orders: [] });
    const again = splitPlan(
      { ...plan([order(1)], LATER), name: "renamed" },
      {
        row: first.row,
        orders: first.orders,
      },
    );
    expect(again.row).toMatchObject({ name: "renamed", updatedAt: LATER });
    expect(again.orders).toEqual([]);
  });

  test("an order no longer in the plan is removed", () => {
    const first = splitPlan(plan([order(1), order(2)]), { orders: [] });
    const again = splitPlan(plan([order(2)], LATER), { row: first.row, orders: first.orders });
    expect(again.removedOrderIds).toEqual([order(1).id]);
    expect(again.orders).toEqual([]);
  });
});

describe("joinPlan", () => {
  test("lists the plan's orders by position, with the latest updatedAt", () => {
    const { row, orders } = splitPlan(plan([order(1), order(2)]), { orders: [] });
    const moved = splitPlan(plan([order(2), order(1)], LATER), { row, orders });
    const stored = orders.map((each) => moved.orders.find((m) => m.id === each.id) ?? each);
    const other = { ...order(3), planId: "6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b9c" };
    const joined = joinPlan(row!, [...stored, { ...other, position: 0, updatedAt: LATER }]);
    expect(joined.orders).toEqual([order(2), order(1)]);
    expect(joined.updatedAt).toBe(LATER);
  });
});
