import { type CapLine, type Plan, type TaxRate, capLines } from "@workspaces/domain";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { withEffectiveAccount } from "../../state/accounts";
import { accountSettingsAtom, planResultAtom } from "../../state/derived";

/** The tax rates a cap's fill price can be shown at. */
export const CAP_TAX_RATES: TaxRate[] = [0.1, 0.08, 0];

/** The plan's caps, with the account it is calculated with; a day cap is `day`'s. */
export function useCapLines(plan: Plan, day: string | undefined): CapLine[] {
  const result = useAtomValue(planResultAtom(plan.id));
  const settings = useAtomValue(accountSettingsAtom);
  return useMemo(
    () => (result ? capLines(withEffectiveAccount(plan, settings), result, day) : []),
    [plan, settings, result, day],
  );
}

const monthDay = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** 「10月」「期間中」: which cap the line is. */
export function scopeText(line: CapLine, today: string | undefined): string {
  const period = line.period ?? "";
  switch (line.scope) {
    case "plan":
      return "このプラン";
    case "campaign":
      return "期間中";
    case "occurrence":
      return "開催ごと";
    case "month":
      return `${Number(period.slice(5, 7))}月`;
    case "day":
      return period === today ? "今日" : monthDay(period);
  }
}

/** 「1回目と共有」, when other plans used the cap. */
export function sharedText(line: CapLine, plans: Plan[]): string | undefined {
  const names = line.sharedWith.flatMap((id) => plans.find((plan) => plan.id === id)?.name ?? []);
  return names.length === 0 ? undefined : `${names.join("・")}と共有`;
}
