import { expect, test } from "vitest";
import { DEFAULT_ACCOUNT_ID, defaultAccount } from "#/model/account.ts";
import type { Plan } from "#/model/plan.ts";
import { accountSettingsOf, accountIdOf, withEffectiveAccount } from "./accounts.ts";

const other = { id: "acc00000-0000-4000-8000-000000000001", name: "サブ" };
const plan: Plan = {
  id: "plan",
  name: "plan",
  accountId: other.id,
  period: { start: "2026-11-01", end: "2026-11-30" },
  orders: [],
  benefits: [],
  updatedAt: "2026-11-22T00:00:00.000Z",
};

test("a profile without account settings uses the default account", () => {
  expect(accountSettingsOf({ updatedAt: plan.updatedAt })).toEqual({
    enabled: false,
    accounts: [defaultAccount()],
  });
});

test.each([
  { enabled: false, accounts: [defaultAccount(), other] },
  { enabled: true, accounts: [defaultAccount()] },
])("disabled or deleted accounts calculate with the default account: %o", (settings) => {
  expect(accountIdOf(plan, settings)).toBe(DEFAULT_ACCOUNT_ID);
  const effective = withEffectiveAccount(plan, settings);
  expect(effective.accountId).toBeUndefined();
  expect(plan.accountId).toBe(other.id);
});

test("a saved account is retained without copying the plan", () => {
  const settings = accountSettingsOf({
    multiAccount: true,
    accounts: [other],
    updatedAt: plan.updatedAt,
  });
  expect(accountIdOf(plan, settings)).toBe(other.id);
  expect(withEffectiveAccount(plan, settings)).toBe(plan);
});
