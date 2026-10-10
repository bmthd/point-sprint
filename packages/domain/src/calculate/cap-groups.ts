import type { Benefit } from "../model/benefit";
import type { DateRule } from "../model/common";

/**
 * Key of the group whose raw points share one cap (see spec §3 "上限の共有範囲"). Caps shared
 * across plans are shared only between plans of the same account.
 */
export function capGroupKey(
  plan: { id: string; accountId: string },
  benefit: Benefit,
  orderDate: string,
): string {
  const shared = `${plan.accountId}:${benefit.sharedKey ?? benefit.id}`;
  switch (benefit.capScope) {
    case "plan":
      return `plan:${plan.id}:${benefit.id}`;
    case "campaign":
      return `campaign:${shared}`;
    case "month":
      return `month:${shared}:${orderDate.slice(0, 7)}`;
    case "occurrence": {
      const occurrence = occurrenceOf(benefit.conditions.dateRule);
      return occurrence === undefined
        ? `occurrence:${shared}`
        : `occurrence:${shared}:${occurrence}`;
    }
  }
}

/**
 * Which occurrence of a campaign a benefit is: its days. Copies of the benefit in other plans of the
 * account share the cap when they are for the same days.
 */
function occurrenceOf(rule: DateRule | undefined): string | undefined {
  switch (rule?.type) {
    case "dates":
      return [...rule.dates].sort().join(",");
    case "range":
      return `${rule.start}~${rule.end}`;
    default:
      return undefined;
  }
}

/**
 * Resolves the cap of a group from the caps of its benefit copies: the smallest one wins.
 * `mismatch` is true when the copies disagree (different values, or only some have a cap).
 */
export function resolveGroupCap(caps: (number | undefined)[]): {
  cap: number | undefined;
  mismatch: boolean;
} {
  const defined = caps.filter((cap): cap is number => cap !== undefined);
  const cap = defined.length === 0 ? undefined : Math.min(...defined);
  const mismatch = caps.some((other) => other !== caps[0]);
  return { cap, mismatch };
}
