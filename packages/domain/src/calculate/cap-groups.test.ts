import { expect, test } from "vitest";
import type { Benefit } from "../model/benefit";
import { capGroupKey } from "./cap-groups";

const PLAN_ID = "f0000000-0000-4000-8000-000000000001";
const BENEFIT_ID = "5b000000-0000-4000-8000-000000000001";

const benefit = (over: Partial<Benefit> = {}): Benefit =>
  ({
    id: BENEFIT_ID,
    kind: "rate-bonus",
    category: "spu",
    label: "bonus",
    enabled: true,
    amountBasis: "tax-excluded",
    capScope: "plan",
    conditions: {},
    params: { rate: 1, roundingUnit: "item" },
    ...over,
  }) as Benefit;

test("plan scope key", () => {
  expect(capGroupKey(PLAN_ID, benefit(), "2026-10-05")).toBe(`plan:${PLAN_ID}:${BENEFIT_ID}`);
});

test("month scope uses sharedKey and order month", () => {
  expect(
    capGroupKey(PLAN_ID, benefit({ capScope: "month", sharedKey: "spu-card" }), "2026-10-05"),
  ).toBe("month:spu-card:2026-10");
});

test("day scope falls back to benefit id", () => {
  expect(capGroupKey(PLAN_ID, benefit({ capScope: "day" }), "2026-10-05")).toBe(
    `day:${BENEFIT_ID}:2026-10-05`,
  );
});

test("campaign scope uses sharedKey", () => {
  expect(
    capGroupKey(PLAN_ID, benefit({ capScope: "campaign", sharedKey: "marathon" }), "2026-10-05"),
  ).toBe("campaign:marathon");
});
