import * as v from "valibot";
import { describe, expect, test } from "vitest";
import { DateRuleSchema } from "./common";
import { PlanSchema } from "./plan";

describe("DateRuleSchema", () => {
  test("rejects a date rule with day 32", () => {
    expect(v.safeParse(DateRuleSchema, { type: "daysOfMonth", days: [32] }).success).toBe(false);
  });
});

describe("PlanSchema", () => {
  test("accepts a plan with no orders", () => {
    const plan = {
      id: "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f7a",
      name: "plan",
      period: { start: "2026-10-01", end: "2026-10-31" },
      benefits: [],
      orders: [],
      updatedAt: "2026-10-04T00:00:00Z",
    };
    expect(v.safeParse(PlanSchema, plan).success).toBe(true);
  });
});
