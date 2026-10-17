import * as v from "valibot";
import { pointsFor } from "./points";
import type { BenefitKindDef, RoundingUnit } from "./types";

const TierSchema = v.object({
  minAmount: v.pipe(v.number(), v.integer(), v.minValue(0)),
  rate: v.pipe(v.number(), v.minValue(0)),
});

const ParamsSchema = v.object({
  tiers: v.pipe(v.array(TierSchema), v.minLength(1)),
  cap: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  roundingUnit: v.optional(v.picklist(["item", "order"]), "item"),
});
/** The total over the campaign's days, tax included, from which `rate` is given. */
export type SpendTier = { minAmount: number; rate: number };

type Params = {
  tiers: SpendTier[];
  cap?: number;
  roundingUnit: RoundingUnit;
};

/** Rate of the highest tier whose `minAmount` the total reaches (0 below the first tier). */
export function spendTierRate(tiers: SpendTier[], spendTotal: number): number {
  let best: SpendTier | undefined;
  for (const tier of tiers) {
    if (tier.minAmount <= spendTotal && (!best || tier.minAmount > best.minAmount)) best = tier;
  }
  return best?.rate ?? 0;
}

/**
 * A rate set by the total of the campaign's orders over its days, given to every one of them:
 * the order they were bought in does not change it.
 */
export const spendTiers: BenefitKindDef<"spend-tiers", Params> = {
  kind: "spend-tiers",
  paramsSchema: ParamsSchema,
  defaultParams: { tiers: [{ minAmount: 5000, rate: 1 }], roundingUnit: "item" },
  onlyReceivingChannels: false,
  rawPoints: ({ params, items, spendTotal }) =>
    pointsFor(items, spendTierRate(params.tiers, spendTotal), params.roundingUnit),
};
