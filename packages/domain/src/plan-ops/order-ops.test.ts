import { describe, expect, test } from "vitest";
import type { Order } from "../model/order";
import type { Plan } from "../model/plan";
import { copyOrder, moveOrder } from "./order-ops";

const SHOP = "a0000000-0000-4000-8000-000000000001";
const ORDER_IDS = [1, 2, 3].map((n) => `0${n}000000-0000-4000-8000-000000000000`);

const order = (id: string, index: number): Order => ({
  id,
  shopId: SHOP,
  date: "2026-10-05",
  lineItems: [
    {
      id: `1${index}000000-0000-4000-8000-000000000001`,
      name: "first",
      unitPrice: 1100,
      quantity: 1,
      taxRate: 0.1,
      discount: 0,
    },
    {
      id: `1${index}000000-0000-4000-8000-000000000002`,
      name: "second",
      unitPrice: 2200,
      quantity: 2,
      taxRate: 0.08,
      discount: 100,
    },
  ],
  onHold: false,
  tags: ["repeat"],
});

const plan: Plan = {
  id: "f0000000-0000-4000-8000-000000000001",
  name: "plan",
  period: { start: "2026-10-01", end: "2026-10-31" },
  benefits: [],
  orders: ORDER_IDS.map(order),
  updatedAt: "2026-10-04T00:00:00Z",
};

function idSequence() {
  let next = 0;
  return () => `99999999-0000-4000-8000-${String(++next).padStart(12, "0")}`;
}

const ids = (p: Plan) => p.orders.map((o) => o.id);

describe("copyOrder", () => {
  test("copy inserts right after the original with new ids", () => {
    const copied = copyOrder(plan, ORDER_IDS[0] ?? "", idSequence());
    const original = copied.orders[0];
    const copy = copied.orders[1];
    expect(original).toEqual(plan.orders[0]);
    expect(copy?.id).toBe("99999999-0000-4000-8000-000000000001");
    expect(copy?.lineItems.map((item) => item.id)).toEqual([
      "99999999-0000-4000-8000-000000000002",
      "99999999-0000-4000-8000-000000000003",
    ]);
    const withoutIds = (o: Order | undefined) => ({
      ...o,
      id: undefined,
      lineItems: o?.lineItems.map((item) => ({ ...item, id: undefined })),
    });
    expect(withoutIds(copy)).toEqual(withoutIds(original));
  });

  test("copy keeps other orders in place", () => {
    const copied = copyOrder(plan, ORDER_IDS[1] ?? "", idSequence());
    expect(ids(copied)).toEqual([
      ORDER_IDS[0],
      ORDER_IDS[1],
      "99999999-0000-4000-8000-000000000001",
      ORDER_IDS[2],
    ]);
  });

  test("copy does not mutate the plan", () => {
    const before = structuredClone(plan);
    const copied = copyOrder(plan, ORDER_IDS[2] ?? "", idSequence());
    expect(plan).toEqual(before);
    const copy = copied.orders[3];
    copy?.lineItems.forEach((item) => {
      item.name = "changed";
    });
    copy?.tags.push("repeat");
    expect(plan).toEqual(before);
  });
});

describe("moveOrder", () => {
  test("move to index", () => {
    const [a, b, c] = ORDER_IDS;
    expect(ids(moveOrder(plan, a ?? "", 2))).toEqual([b, c, a]);
    expect(ids(moveOrder(plan, c ?? "", 0))).toEqual([c, a, b]);
    expect(ids(moveOrder(plan, b ?? "", 1))).toEqual([a, b, c]);
  });

  test("move clamps out-of-range index", () => {
    const [a, b, c] = ORDER_IDS;
    expect(ids(moveOrder(plan, a ?? "", 10))).toEqual([b, c, a]);
    expect(ids(moveOrder(plan, c ?? "", -3))).toEqual([c, a, b]);
  });

  test("move does not mutate the plan", () => {
    const before = structuredClone(plan);
    moveOrder(plan, ORDER_IDS[0] ?? "", 2);
    expect(plan).toEqual(before);
  });
});

test("unknown order throws", () => {
  const unknown = "00000000-0000-4000-8000-000000000000";
  expect(() => copyOrder(plan, unknown, idSequence())).toThrow(/order/);
  expect(() => moveOrder(plan, unknown, 0)).toThrow(/order/);
});
