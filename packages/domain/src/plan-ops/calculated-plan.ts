import type { Plan } from "#/model/plan.ts";
import type { Shop } from "#/model/shop.ts";
import type { SpuMonth } from "#/model/spu-month.ts";
import { type AccountSettings, withEffectiveAccount } from "./accounts.ts";
import { planWithSpu } from "./spu-months.ts";
import { trialSpuAchievements } from "./spu-purchases.ts";

/** Apply the effective account and monthly SPU, including a held plan's own trial achievements. */
export function calculatedPlan(
  plan: Plan,
  settings: AccountSettings,
  months: SpuMonth[],
  shops: Shop[],
): Plan {
  const effective = withEffectiveAccount(plan, settings);
  return planWithSpu(effective, months, trialSpuAchievements(effective, shops));
}
