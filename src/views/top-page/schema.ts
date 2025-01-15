import * as v from "valibot";

const itemSchema = v.object({
  active: v.boolean(),
  name: v.string(),
  price: v.fallback(v.pipe(v.number(), v.minValue(0)), 0),
  taxRate: v.number(),
  additionalRate: v.number(),
  campaigns: v.record(v.string(), v.boolean()),
  sameStore: v.boolean(),
});

const spuSchema = v.object({
  name: v.string(),
  rate: v.number(),
  checked: v.boolean(),
});

export const spuEventSchema = v.object({
  items: v.array(itemSchema),
  spuButtons: v.record(v.string(), spuSchema),
  maxPoint: v.number(),
});

export type SPUEvent = v.InferOutput<typeof spuEventSchema>;

export type Item = v.InferOutput<typeof itemSchema>;
