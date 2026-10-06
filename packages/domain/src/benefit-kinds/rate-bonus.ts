import * as v from "valibot";
import { pointsFor } from "./points";
import type { BenefitKindDef, RoundingUnit } from "./types";

const RoundingUnitSchema = v.picklist(["item", "order"]);
const CapSchema = v.pipe(v.number(), v.integer(), v.minValue(0));

const ParamsSchema = v.object({
  rate: v.pipe(v.number(), v.gtValue(0)),
  cap: v.optional(CapSchema),
  roundingUnit: v.optional(RoundingUnitSchema, "item"),
});
type Params = { rate: number; cap?: number; roundingUnit: RoundingUnit };

export const rateBonus: BenefitKindDef<"rate-bonus", Params> = {
  kind: "rate-bonus",
  paramsSchema: ParamsSchema,
  defaultParams: { rate: 1, roundingUnit: "item" },
  onlyReceivingChannels: false,
  rawPoints: ({ params, items }) => pointsFor(items, params.rate, params.roundingUnit),
};
