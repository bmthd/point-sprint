import * as v from "valibot";
import { expect, test } from "vitest";
import { type Plan, PlanSchema } from "#/model/plan.ts";
import { togglePlanHold } from "./plan-hold.ts";

const storedPlanWithoutOnHold = {
  id: "a0000000-0000-4000-8000-000000000010",
  name: "plan",
  period: { start: "2026-10-01", end: "2026-10-31" },
  benefits: [],
  orders: [],
  updatedAt: "2026-10-01T00:00:00.000Z",
};
const plan: Plan = v.parse(PlanSchema, storedPlanWithoutOnHold);

test("togglePlanHold holds a plan and releasing the hold drops the field", () => {
  const held = togglePlanHold(plan);
  expect(held.onHold).toBe(true);
  expect("onHold" in togglePlanHold(held)).toBe(false);
});

test("a stored plan without onHold parses as not held", () => {
  const parsed = v.parse(PlanSchema, storedPlanWithoutOnHold);
  expect(parsed.onHold).toBeUndefined();
});
