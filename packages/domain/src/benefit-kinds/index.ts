import * as v from "valibot";
import { ConditionsSchema, IdSchema } from "../model/common";
import { rateBonus } from "./rate-bonus";
import { shopAround } from "./shop-around";
import type { BenefitKindDef } from "./types";

export { pointsFor } from "./points";
export { rateBonus } from "./rate-bonus";
export { shopAround } from "./shop-around";
export type { BenefitKindDef, EligibleItem, RoundingUnit } from "./types";

export const benefitKinds = { "rate-bonus": rateBonus, "shop-around": shopAround } as const;

function benefitEntry<K extends string, P extends { cap?: number }>(def: BenefitKindDef<K, P>) {
  return v.object({
    id: IdSchema,
    kind: v.literal(def.kind),
    category: v.picklist(["base", "spu", "campaign"]),
    label: v.string(),
    imagePath: v.optional(v.pipe(v.string(), v.startsWith("/img/"))),
    enabled: v.boolean(),
    conditions: v.optional(ConditionsSchema, {}),
    amountBasis: v.optional(v.picklist(["tax-excluded", "tax-included"]), "tax-excluded"),
    capScope: v.optional(v.picklist(["plan", "campaign", "month", "day", "occurrence"]), "plan"),
    sharedKey: v.optional(v.pipe(v.string(), v.minLength(1))),
    exclusiveGroup: v.optional(v.pipe(v.string(), v.minLength(1))),
    requires: v.optional(IdSchema),
    params: def.paramsSchema,
  });
}

export const BenefitSchema = v.variant("kind", [
  benefitEntry(benefitKinds["rate-bonus"]),
  benefitEntry(benefitKinds["shop-around"]),
]);
export type Benefit = v.InferOutput<typeof BenefitSchema>;

// Compile-time guard: every registered benefit kind must have a BenefitSchema variant, and vice versa.
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type _BenefitKindsMatchSchema = Assert<Equal<Benefit["kind"], keyof typeof benefitKinds>>;
