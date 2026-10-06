import * as v from "valibot";
import { pointsFor } from "./points";
import type { BenefitKindDef, RoundingUnit } from "./types";

const TierSchema = v.object({
  minShops: v.pipe(v.number(), v.integer(), v.minValue(1)),
  rate: v.pipe(v.number(), v.minValue(0)),
});

const ParamsSchema = v.object({
  tiers: v.pipe(v.array(TierSchema), v.minLength(1)),
  cap: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  roundingUnit: v.optional(v.picklist(["item", "order"]), "item"),
});
export type ShopAroundTier = { minShops: number; rate: number };

type Params = {
  tiers: ShopAroundTier[];
  cap?: number;
  roundingUnit: RoundingUnit;
};

/** Rate of the highest tier whose `minShops` the shop count reaches (0 below the first tier). */
export function tierRate(tiers: ShopAroundTier[], shopCount: number): number {
  let best: ShopAroundTier | undefined;
  for (const tier of tiers) {
    if (tier.minShops <= shopCount && (!best || tier.minShops > best.minShops)) best = tier;
  }
  return best?.rate ?? 0;
}

export const shopAround: BenefitKindDef<"shop-around", Params> = {
  kind: "shop-around",
  paramsSchema: ParamsSchema,
  defaultParams: { tiers: [{ minShops: 2, rate: 1 }], roundingUnit: "item" },
  onlyReceivingChannels: true,
  rawPoints: ({ params, items, shopCount }) =>
    pointsFor(items, tierRate(params.tiers, shopCount), params.roundingUnit),
};
