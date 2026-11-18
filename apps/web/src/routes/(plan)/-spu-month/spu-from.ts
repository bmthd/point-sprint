import type { Plan } from "@workspaces/domain";
import { atom } from "jotai";
import { accountIdOf } from "#/state/accounts.ts";
import { accountSettingsAtom } from "#/state/derived.ts";

declare module "@tanstack/react-router" {
  interface HistoryState {
    /**
     * The plan the month's SPU page was opened from. The page goes back to it and switches among
     * its months; without it (from 共通設定, or the URL opened directly) the page goes back to
     * 共通設定 and steps a month at a time.
     */
    spuFrom?: { planId: string };
  }
}

/** Opens the month's SPU page from the plan `planId`, the URL being the same as from anywhere. */
export function spuPageFromPlan(planId: string, month: string, account: string | undefined) {
  return {
    to: "/spu",
    search: { month, ...(account === undefined ? {} : { account }) },
    state: { spuFrom: { planId } },
  } as const;
}

/**
 * Opens the month's SPU page from the plan: for the plan's account once the user tells accounts
 * apart, read when the page is opened.
 */
export const spuPageFromPlanAtom = atom(null, (get, _set, plan: Plan, month: string) => {
  const settings = get(accountSettingsAtom);
  const account = settings.enabled ? accountIdOf(plan, settings) : undefined;
  return spuPageFromPlan(plan.id, month, account);
});
