import * as v from "valibot";
import { type Account, AccountSchema, DEFAULT_ACCOUNT_ID, defaultAccount } from "./account";
import { BenefitSchema } from "./benefit";
import { IdSchema, PeriodSchema, TimestampSchema } from "./common";
import { OrderSchema } from "./order";

export const PlanSchema = v.object({
  id: IdSchema,
  name: v.string(),
  officialEventId: v.optional(v.string()),
  /** The account the plan's orders are bought with; absent for the default account. */
  accountId: v.optional(IdSchema),
  period: PeriodSchema,
  benefits: v.array(BenefitSchema),
  orders: v.array(OrderSchema),
  updatedAt: TimestampSchema,
});
export type Plan = v.InferOutput<typeof PlanSchema>;

export const ProfileSchema = v.object({
  spuBenefits: v.array(BenefitSchema),
  /** Whether the user tells accounts apart. Until they do, every plan is the default account's. */
  multiAccount: v.optional(v.boolean()),
  /** Every account, the default one included; absent for the default account alone. */
  accounts: v.optional(v.array(AccountSchema)),
  updatedAt: TimestampSchema,
});
export type Profile = v.InferOutput<typeof ProfileSchema>;

/** The ID of the account a plan is bought with. */
export const planAccountId = (plan: Plan): string => plan.accountId ?? DEFAULT_ACCOUNT_ID;

/** The profile's accounts. The default account is always among them, first unless stored. */
export function accountsOf(profile: Profile): Account[] {
  const accounts = profile.accounts ?? [];
  return accounts.some((account) => account.id === DEFAULT_ACCOUNT_ID)
    ? accounts
    : [defaultAccount(), ...accounts];
}
