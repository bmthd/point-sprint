import * as v from "valibot";
import { spuId } from "../const/spu";

const switchSchema = v.optional(
  v.pipe(
    v.union([v.literal("on"), v.boolean()]),
    v.transform((value) => (value === "on" ? true : value)),
  ),
  false,
);

const itemSchema = v.object({
  id: v.string(),
  active: switchSchema,
  name: v.optional(v.string()),
  price: v.optional(v.pipe(v.number(), v.minValue(0)), 0),
  taxRate: v.fallback(
    v.pipe(
      v.string(),
      v.decimal(),
      v.transform((input) => Number.parseFloat(input)),
      v.minValue(0),
    ),
    1,
  ),
  additionalRate: v.optional(v.pipe(v.number(), v.minValue(0)), 0),
  // campaigns: v.record(v.string(), v.boolean()),
  sameStore: v.fallback(v.boolean(), false),
});

export const spuEventCalcSchema = v.object({
  items: v.array(itemSchema),
  spu: v.optional(v.record(v.picklist(spuId), switchSchema), {}),
  maxPoint: v.number(),
  taxRate: v.number(),
});

export type SPUEventInput = v.InferInput<typeof spuEventCalcSchema>;
export type SPUEventOutput = v.InferOutput<typeof spuEventCalcSchema>;

export type CalcItem = v.InferOutput<typeof itemSchema>;
