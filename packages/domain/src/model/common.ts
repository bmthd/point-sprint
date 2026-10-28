import * as v from "valibot";

export const IdSchema = v.pipe(v.string(), v.uuid());
export type Id = v.InferOutput<typeof IdSchema>;

export const IsoDateSchema = v.pipe(v.string(), v.isoDate());
export type IsoDate = v.InferOutput<typeof IsoDateSchema>;

/** `20:00`. */
export const IsoTimeSchema = v.pipe(v.string(), v.isoTime());

export const TimestampSchema = v.pipe(v.string(), v.isoTimestamp());
export type Timestamp = v.InferOutput<typeof TimestampSchema>;

export const ChannelIdSchema = v.picklist(["rakuten-ichiba", "rakuten-books", "rakuten-kobo"]);
export type ChannelId = v.InferOutput<typeof ChannelIdSchema>;

export const ShopTagSchema = v.picklist(["39shop"]);
export type ShopTag = v.InferOutput<typeof ShopTagSchema>;

// `brand-day`: an order of 楽天ブランドデー items. Hundreds of shops take part, some with only a few of
// their items, so the user marks the order rather than the shop.
/** `repeat`: リピート購入. `24h`: 24時間限定 対象ショップポイント10倍, whose shops change every time. */
export const OrderTagSchema = v.picklist(["repeat", "brand-day", "24h"]);
export type OrderTag = v.InferOutput<typeof OrderTagSchema>;

export const PeriodSchema = v.object({ start: IsoDateSchema, end: IsoDateSchema });
export type Period = v.InferOutput<typeof PeriodSchema>;

/** `2026-10`. */
export const MonthSchema = v.pipe(v.string(), v.regex(/^\d{4}-(0[1-9]|1[0-2])$/));

/** Every day of the period, `YYYY-MM-DD`. */
export function daysOf(period: Period): string[] {
  const days: string[] = [];
  const [year = 0, month = 1, day = 1] = period.start.split("-").map(Number);
  for (let offset = 0; ; offset++) {
    const date = new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
    if (date > period.end) return days;
    days.push(date);
  }
}

/** `YYYY-MM` of every month the period touches. */
export function monthsOf(period: Period): string[] {
  const months: string[] = [];
  let year = Number(period.start.slice(0, 4));
  let month = Number(period.start.slice(5, 7));
  const last = period.end.slice(0, 7);
  for (;;) {
    const current = `${year}-${String(month).padStart(2, "0")}`;
    months.push(current);
    if (current >= last) return months;
    month += 1;
    if (month > 12) {
      year += 1;
      month = 1;
    }
  }
}

/** The month `count` months after `month` (`YYYY-MM`); before it when `count` is negative. */
export function addMonths(month: string, count: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

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
  /** Only the orders of these months (`YYYY-MM`): an SPU item in the months it is on. */
  months: v.optional(v.array(MonthSchema)),
});
export type Conditions = v.InferOutput<typeof ConditionsSchema>;
