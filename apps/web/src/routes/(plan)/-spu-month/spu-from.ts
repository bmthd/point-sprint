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
