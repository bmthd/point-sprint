import {
  type Account,
  DEFAULT_ACCOUNT_ID,
  type Plan,
  type Profile,
  accountsOf,
  planAccountId,
} from "@workspaces/domain";

export type AccountSettings = { enabled: boolean; accounts: Account[] };

/** Whether the user tells accounts apart, and the accounts. */
export const accountSettingsOf = (profile: Profile): AccountSettings => ({
  enabled: profile.multiAccount ?? false,
  accounts: accountsOf(profile),
});

/**
 * The account a plan is calculated and shown with: the default one until the user tells accounts
 * apart, and when the plan's account was deleted.
 */
export function accountIdOf(plan: Plan, settings: AccountSettings): string {
  if (!settings.enabled) return DEFAULT_ACCOUNT_ID;
  const id = planAccountId(plan);
  return settings.accounts.some((account) => account.id === id) ? id : DEFAULT_ACCOUNT_ID;
}

/** The plan as it is calculated: its account replaced by the one `accountIdOf` gives. */
export function withEffectiveAccount(plan: Plan, settings: AccountSettings): Plan {
  const id = accountIdOf(plan, settings);
  if (id === planAccountId(plan)) return plan;
  const { accountId: _, ...rest } = plan;
  return id === DEFAULT_ACCOUNT_ID ? rest : { ...rest, accountId: id };
}
