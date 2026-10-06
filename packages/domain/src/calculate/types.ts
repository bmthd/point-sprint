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
};

export type HeldEstimate = { orderId: string; points: number };
