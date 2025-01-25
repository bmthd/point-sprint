import { D, pipe } from "@mobily/ts-belt";
import * as v from "valibot";
import { SPU_DEF } from "../const/spu";

const itemSchema = v.object({
  id: v.string(),
  active: v.fallback(v.boolean(), true),
  name: v.optional(v.string()),
  price: v.optional(v.pipe(v.number(), v.minValue(0))),
  taxRate: v.pipe(v.string(), v.decimal(), v.minValue("0")),
  additionalRate: v.optional(v.pipe(v.number())),
  campaign: v.record(v.string(), v.boolean()),
  sameStore: v.fallback(v.boolean(), false),
});

/**
 * 保存済みの計算結果または初期値を読み込み、計算に使用するデータとしてparseする
 * 足りない値を追加し、Formの初期値として使用できる状態にする
 */
export const spuEventStorageSchema = v.object({
  items: v.array(itemSchema),
  spu: v.pipe(
    v.optional(v.record(v.string(), v.boolean()), {}),
    // 足りないキーをfalseで追加する
    v.transform((record) =>
      pipe(
        SPU_DEF,
        D.mapWithKey((key) => record[key] ?? false),
      ),
    ),
  ),
  maxPoint: v.number(),
  taxRate: v.number(),
  createdAt: v.pipe(v.string(), v.isoDateTime()),
  updatedAt: v.pipe(
    v.string(),
    v.transform(() => new Date().toISOString()),
  ),
});

export type SPUEventInput = v.InferInput<typeof spuEventStorageSchema>;
export type SPUEventFromStorage = v.InferOutput<typeof spuEventStorageSchema>;

export type Item = v.InferInput<typeof itemSchema>;

export const initializeItem = (): Item => ({
  id: btoa(crypto.randomUUID()),
  active: true,
  taxRate: "1.1",
  campaign: {},
  sameStore: false,
});

export const initializeItems = (length: number): Item[] =>
  Array.from({ length }).map(() => initializeItem());

export const initializeSPUEventForm = (): SPUEventInput => ({
  items: initializeItems(10),
  maxPoint: 7000,
  spu: {},
  taxRate: 1.1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
