import { describe, expect, test } from "vitest";
import { migrateRow, seedRows } from "./index";

const plan = (orders: unknown[]) => ({
  id: "p",
  period: { start: "2026-10-01", end: "2026-10-31" },
  benefits: [],
  orders,
  updatedAt: "2026-10-05T00:00:00.000Z",
});

describe("order rows", () => {
  test("the orders leave the plan", () => {
    expect(migrateRow("plans", plan([{ id: "o1" }]), 10)).toEqual({
      id: "p",
      period: { start: "2026-10-01", end: "2026-10-31" },
      benefits: [],
      updatedAt: "2026-10-05T00:00:00.000Z",
    });
  });

  test("each order becomes a row of the plan, in its order and dated like the plan", () => {
    expect(
      seedRows({ plans: [plan([{ id: "o1" }, "broken", { id: "o2" }])], profile: undefined }, 10)
        .orders,
    ).toEqual([
      { id: "o1", planId: "p", position: 0, updatedAt: "2026-10-05T00:00:00.000Z" },
      { id: "o2", planId: "p", position: 2, updatedAt: "2026-10-05T00:00:00.000Z" },
    ]);
  });

  test("a plan that cannot be read adds no rows", () => {
    expect(seedRows({ plans: ["broken", { id: "p" }], profile: undefined }, 10).orders).toEqual([]);
  });
});
