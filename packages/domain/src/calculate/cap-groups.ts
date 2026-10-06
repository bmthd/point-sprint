import type { Benefit } from "../model/benefit";

/** Key of the group whose raw points share one cap (see spec §3 "上限の共有範囲"). */
export function capGroupKey(planId: string, benefit: Benefit, orderDate: string): string {
  const shared = benefit.sharedKey ?? benefit.id;
  switch (benefit.capScope) {
    case "plan":
      return `plan:${planId}:${benefit.id}`;
    case "campaign":
      return `campaign:${shared}`;
    case "month":
      return `month:${shared}:${orderDate.slice(0, 7)}`;
    case "day":
      return `day:${shared}:${orderDate}`;
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
