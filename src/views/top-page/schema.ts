import { D, pipe } from "@mobily/ts-belt";
import * as v from "valibot";
import { SPU_DEF } from "./const/spu";

const itemSchema = v.object({
  id: v.string(),
  active: v.fallback(v.boolean(), true),
  name: v.optional(v.string()),
  price: v.optional(v.pipe(v.number(), v.minValue(0)), 0),
  taxRate: v.fallback(v.pipe(v.number(), v.minValue(0)), 1),
  additionalRate: v.optional(v.pipe(v.number(), v.minValue(0)), 0),
  // campaigns: v.record(v.string(), v.boolean()),
  sameStore: v.fallback(v.boolean(), false),
});

export const spuEventSchema = v.object({
  items: v.array(itemSchema),
  spu: v.record(v.string(), v.boolean()),
  maxPoint: v.number(),
});

export type SPUEventInput = v.InferInput<typeof spuEventSchema>;
export type SPUEventOutput = v.InferOutput<typeof spuEventSchema>;

export type Item = v.InferInput<typeof itemSchema>;

export const initializeItem = (): Item => ({
  id: btoa(crypto.randomUUID()),
  active: true,
  taxRate: 1.1,
  // campaigns: {},
  sameStore: false,
});

export const initializeItems = (length: number): Item[] =>
  Array.from({ length }).map(() => initializeItem());

const initializeSPU = (): Record<string, boolean> =>
  pipe(
    SPU_DEF,
    D.map(() => false),
  );

export const initializeSPUEventForm = (): SPUEventInput => ({
  items: initializeItems(10),
  maxPoint: 7000,
  spu: initializeSPU(),
});
