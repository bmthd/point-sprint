import * as v from "valibot";

export const IdSchema = v.pipe(v.string(), v.uuid());
export type Id = v.InferOutput<typeof IdSchema>;

export const IsoDateSchema = v.pipe(v.string(), v.isoDate());
export type IsoDate = v.InferOutput<typeof IsoDateSchema>;

export const TimestampSchema = v.pipe(v.string(), v.isoTimestamp());
export type Timestamp = v.InferOutput<typeof TimestampSchema>;

export const ChannelIdSchema = v.picklist(["rakuten-ichiba", "rakuten-books", "rakuma"]);
export type ChannelId = v.InferOutput<typeof ChannelIdSchema>;

export const ShopTagSchema = v.picklist(["39shop"]);
export type ShopTag = v.InferOutput<typeof ShopTagSchema>;

export const OrderTagSchema = v.picklist(["repeat"]);
export type OrderTag = v.InferOutput<typeof OrderTagSchema>;

export const PeriodSchema = v.object({ start: IsoDateSchema, end: IsoDateSchema });
export type Period = v.InferOutput<typeof PeriodSchema>;

/** The date in `period` nearest to `date`. */
export function closestDateInPeriod({ date, period }: { date: string; period: Period }): string {
  if (date < period.start) return period.start;
  if (date > period.end) return period.end;
  return date;
}

export const DateRuleSchema = v.variant("type", [
  v.object({
    type: v.literal("daysOfMonth"),
    days: v.pipe(
      v.array(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(31))),
      v.minLength(1),
    ),
  }),
  v.object({ type: v.literal("dates"), dates: v.pipe(v.array(IsoDateSchema), v.minLength(1)) }),
  v.object({ type: v.literal("range"), start: IsoDateSchema, end: IsoDateSchema }),
]);
export type DateRule = v.InferOutput<typeof DateRuleSchema>;

export const ConditionsSchema = v.object({
  channels: v.optional(v.array(ChannelIdSchema)),
  shopIds: v.optional(v.array(IdSchema)),
  shopTags: v.optional(v.array(ShopTagSchema)),
  dateRule: v.optional(DateRuleSchema),
  minOrderAmount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
  orderTags: v.optional(v.array(OrderTagSchema)),
});
export type Conditions = v.InferOutput<typeof ConditionsSchema>;
