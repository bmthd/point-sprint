import {
  type CapLine,
  type DateRule,
  type OrderTag,
  type Period,
  type Plan,
  type ShopTag,
  type TaxRate,
  capLines,
  daysOf,
  inDateRule,
} from "@workspaces/domain";
import { useAtomValue } from "jotai";
import { useMemo } from "react";
import { calculatedPlanAtom, planResultAtom } from "../../state/derived";
import { yen } from "../../ui/format";

/** The tax rates a cap's fill price can be shown at. */
export const CAP_TAX_RATES: TaxRate[] = [0.1, 0.08, 0];

/** The plan's caps, with the account and the SPU it is calculated with. */
export function useCapLines(plan: Plan): CapLine[] {
  const result = useAtomValue(planResultAtom(plan.id));
  const calculated = useAtomValue(calculatedPlanAtom(plan.id));
  return useMemo(
    () => (result && calculated ? capLines(calculated, result) : []),
    [calculated, result],
  );
}

const monthDay = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** 「10月」「期間中」「10/6」: which cap the line is. An occurrence is shown by its first day. */
export function scopeText(line: CapLine, today: string | undefined): string {
  const period = line.period ?? "";
  switch (line.scope) {
    case "plan":
      return "このプラン";
    case "campaign":
      return "期間中";
    case "month":
      return `${Number(period.slice(5, 7))}月`;
    case "occurrence":
      if (line.period === null) return "1回の開催";
      return period === today ? "今日" : monthDay(period);
  }
}

/** 「1回目と共有」, when other plans used the cap. */
export function sharedText(line: CapLine, plans: Plan[]): string | undefined {
  const names = line.sharedWith.flatMap((id) => plans.find((plan) => plan.id === id)?.name ?? []);
  return names.length === 0 ? undefined : `${names.join("・")}と共有`;
}

const SHOP_TAG_TEXT: Record<ShopTag, string> = { "39shop": "39ショップ" };
const ORDER_TAG_TEXT: Record<OrderTag, string> = {
  repeat: "リピート購入",
  "brand-day": "ブランドデー",
  "24h": "24時間限定",
};

function daysText(rule: DateRule): string {
  switch (rule.type) {
    case "daysOfMonth":
      return `${rule.days.join("・")}日`;
    case "dates":
      return rule.dates.map(monthDay).join("・");
    case "range":
      return `${monthDay(rule.start)}〜${monthDay(rule.end)}`;
  }
}

/**
 * 「10/25・24時間限定の注文で」: the orders whose price fills the line's cap, when the benefit is
 * only for some days of the period, some tags or a minimum order. Its channels go unsaid, as its
 * name tells them.
 */
export function conditionText(line: CapLine, period: Period): string | undefined {
  const { dateRule, shopTags = [], orderTags = [], minOrderAmount } = line.benefit.conditions;
  const someDays = dateRule && !daysOf(period).every((day) => inDateRule(dateRule, day));
  const parts = [
    ...(someDays ? [daysText(dateRule)] : []),
    ...shopTags.map((tag) => SHOP_TAG_TEXT[tag]),
    ...orderTags.map((tag) => ORDER_TAG_TEXT[tag]),
    ...(minOrderAmount === undefined ? [] : [`${yen(minOrderAmount)}以上`]),
  ];
  return parts.length === 0 ? undefined : `${parts.join("・")}の注文で`;
}
