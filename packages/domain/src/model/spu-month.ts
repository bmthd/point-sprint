import * as v from "valibot";
import { IdSchema, MonthSchema, TimestampSchema } from "./common";

/**
 * The SPU one account achieved in one month: the ids of the `standardSpu` items that are on. 楽天
 * decides the SPU per account and month, so every plan of the account shares it for the orders of
 * that month.
 */
export const SpuMonthSchema = v.object({
  /** `spuMonthId(accountId, month)`. */
  id: v.string(),
  accountId: IdSchema,
  month: MonthSchema,
  enabledIds: v.array(v.string()),
  updatedAt: TimestampSchema,
});
export type SpuMonth = v.InferOutput<typeof SpuMonthSchema>;

export function spuMonthId(accountId: string, month: string) {
  return `${accountId}:${month}`;
}
