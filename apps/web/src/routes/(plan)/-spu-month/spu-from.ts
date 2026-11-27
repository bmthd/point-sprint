import { atom } from "jotai";
import { accountIdOf } from "@workspaces/domain";
import { accountSettingsAtom, planAtom } from "#/state/derived.ts";

declare module "@tanstack/react-router" {
  interface HistoryState {
    /**
     * The plan the month's SPU page was opened from. The page goes back to it and switches among
     * its months; without it (from 共通設定, or the URL opened directly) the page goes back to
     * 共通設定 and steps a month at a time. `settings`: opened from the plan's settings, which the
     * page goes back to instead of the plan.
     */
    spuFrom?: { planId: string; settings?: boolean };
  }
}

/**
 * Opens the month's SPU page from the plan `planId`, or from its settings when `fromSettings`, the
 * URL being the same as from anywhere.
 */
export function spuPageFromPlan(
  planId: string,
  month: string,
  account: string | undefined,
  fromSettings = false,
) {
  return {
    to: "/spu",
    search: { month, ...(account === undefined ? {} : { account }) },
    state: { spuFrom: fromSettings ? { planId, settings: true } : { planId } },
  } as const;
}

/**
 * Opens the month's SPU page from the plan: for the plan's account once the user tells accounts
 * apart, read when the page is opened.
 */
export const spuPageFromPlanAtom = atom(
  null,
  (get, _set, planId: string, month: string, fromSettings?: boolean) => {
    const plan = get(planAtom(planId));
    const settings = get(accountSettingsAtom);
    const account = settings.enabled && plan ? accountIdOf(plan, settings) : undefined;
    return spuPageFromPlan(planId, month, account, fromSettings);
  },
);
