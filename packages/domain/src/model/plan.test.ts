import * as v from "valibot";
import { describe, expect, test } from "vitest";
import { DateRuleSchema } from "./common";
import { DEFAULT_ACCOUNT_ID } from "./account";
import { PlanSchema, ProfileSchema, accountsOf, planAccountId } from "./plan";

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

describe("accounts", () => {
  const ACCOUNT_2 = "acc00000-0000-4000-8000-000000000002";
  const saved = {
    id: "4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f7a",
    name: "plan",
    period: { start: "2026-10-01", end: "2026-10-31" },
    benefits: [],
    orders: [],
    updatedAt: "2026-10-04T00:00:00Z",
  };

  test("a plan saved before accounts existed is the default account's", () => {
    const plan = v.parse(PlanSchema, saved);
    expect(planAccountId(plan)).toBe(DEFAULT_ACCOUNT_ID);
    expect(planAccountId({ ...plan, accountId: ACCOUNT_2 })).toBe(ACCOUNT_2);
  });

  test("a profile saved before accounts existed has the default account alone", () => {
    const profile = v.parse(ProfileSchema, { spuBenefits: [], updatedAt: saved.updatedAt });
    expect(profile.multiAccount).toBeUndefined();
    expect(accountsOf(profile)).toEqual([{ id: DEFAULT_ACCOUNT_ID, name: "メイン" }]);
  });

  test("the default account comes first unless the profile holds it", () => {
    const second = { id: ACCOUNT_2, name: "サブ" };
    const base = { spuBenefits: [], updatedAt: saved.updatedAt };
    expect(accountsOf({ ...base, accounts: [second] }).map((a) => a.id)).toEqual([
      DEFAULT_ACCOUNT_ID,
      ACCOUNT_2,
    ]);
    const renamed = { id: DEFAULT_ACCOUNT_ID, name: "自分" };
    expect(accountsOf({ ...base, accounts: [renamed, second] })).toEqual([renamed, second]);
  });

  test("rejects an account with an empty name", () => {
    const profile = {
      spuBenefits: [],
      updatedAt: saved.updatedAt,
      accounts: [{ id: ACCOUNT_2, name: "" }],
    };
    expect(v.safeParse(ProfileSchema, profile).success).toBe(false);
  });
});
