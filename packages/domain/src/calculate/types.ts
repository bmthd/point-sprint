import type { Id } from "../model/common";
import type { ShopAroundOutlook } from "./outlook";
import type { PointGroup } from "./point-group";

export type BreakdownRow = { lineItemId: string; source: Id | "shop-rate"; points: number };

export type BenefitTotal = {
  benefitId: Id;
  rawPoints: number;
  cappedPoints: number;
  capReached: boolean;
};

export type CalculationWarning =
  | { type: "unknown-shop"; orderId: string }
  | { type: "order-outside-period"; orderId: string }
  | { type: "shared-cap-mismatch"; groupKey: string };

export type CalculationResult = {
  breakdown: BreakdownRow[];
  benefitTotals: BenefitTotal[];
  shopCount: number;
  total: number;
  warnings: CalculationWarning[];
  /** Breakdown rows summed by point group. The values sum to `total`. */
  groupTotals: Record<PointGroup, number>;
  /**
   * Per held order, how much the sum of all plans' totals grows when only that order is unheld.
   * Points that only move between plans sharing a cap are not counted.
   */
  heldEstimates: HeldEstimate[];
  /**
   * Outlook of the plan's first enabled shop-around benefit, or `null` when it has none.
   * Its `cap` is what is left of the cap group for this plan.
   */
  shopAroundOutlook: ShopAroundOutlook | null;
  /**
   * Cap groups of the plan's account, keyed by `capGroupKey`, including the ones only other plans
   * use. Held orders are not in them.
   */
  capUsage: Record<string, CapGroupUsage>;
};

/** How much of one cap group is used, by plan. */
export type CapGroupUsage = {
  /** The group's resolved cap; `undefined` when no copy of the benefit has one. */
  cap: number | undefined;
  /** Raw points of every member, before the cap. */
  raw: number;
  /** Points each plan received from the group after the cap, keyed by plan ID. */
  points: Record<string, number>;
};

export type HeldEstimate = { orderId: string; points: number };
