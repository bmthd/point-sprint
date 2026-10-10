import { expect, test } from "vitest";
import type { Benefit } from "../model/benefit";
import { capGroupKey } from "./cap-groups";

const PLAN_ID = "f0000000-0000-4000-8000-000000000001";
const BENEFIT_ID = "5b000000-0000-4000-8000-000000000001";
const ACCOUNT_ID = "acc00000-0000-4000-8000-000000000001";
const PLAN = { id: PLAN_ID, accountId: ACCOUNT_ID };

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
  expect(capGroupKey(PLAN, benefit(), "2026-10-05")).toBe(`plan:${PLAN_ID}:${BENEFIT_ID}`);
});

test("month scope uses sharedKey and order month", () => {
  expect(
    capGroupKey(PLAN, benefit({ capScope: "month", sharedKey: "spu-card" }), "2026-10-05"),
  ).toBe(`month:${ACCOUNT_ID}:spu-card:2026-10`);
});

test("day scope falls back to benefit id", () => {
  expect(capGroupKey(PLAN, benefit({ capScope: "day" }), "2026-10-05")).toBe(
    `day:${ACCOUNT_ID}:${BENEFIT_ID}:2026-10-05`,
  );
});

test("campaign scope uses sharedKey", () => {
  expect(
    capGroupKey(PLAN, benefit({ capScope: "campaign", sharedKey: "marathon" }), "2026-10-05"),
  ).toBe(`campaign:${ACCOUNT_ID}:marathon`);
});

test("occurrence scope uses the benefit instance and shares it across an account's plans", () => {
  const occurrence = benefit({ capScope: "occurrence", sharedKey: "sports-win" });
  const otherPlan = { id: "f0000000-0000-4000-8000-000000000002", accountId: ACCOUNT_ID };

  expect(capGroupKey(PLAN, occurrence, "2026-10-05")).toBe(
    `occurrence:${ACCOUNT_ID}:${BENEFIT_ID}`,
  );
  expect(capGroupKey(otherPlan, occurrence, "2026-10-06")).toBe(
    capGroupKey(PLAN, occurrence, "2026-10-05"),
  );
});

test("plan scope key does not depend on the account", () => {
  const other = { id: PLAN_ID, accountId: "acc00000-0000-4000-8000-000000000002" };
  expect(capGroupKey(other, benefit(), "2026-10-05")).toBe(
    capGroupKey(PLAN, benefit(), "2026-10-05"),
  );
});

test.each(["campaign", "month", "day", "occurrence"] as const)(
  "%s scope keys differ by account",
  (capScope) => {
    const other = { id: PLAN_ID, accountId: "acc00000-0000-4000-8000-000000000002" };
    const shared = benefit({ capScope, sharedKey: "marathon" });
    expect(capGroupKey(other, shared, "2026-10-05")).not.toBe(
      capGroupKey(PLAN, shared, "2026-10-05"),
    );
  },
);
