import * as v from "valibot";
import { type NumberUnit, toDate, toNumber, toOptionalText, toText } from "./normalize";

// The schemas of what is typed into the forms, shared by every form. Each first makes the field's
// text a value (normalize.ts), then checks it here. A message names the field and says what to
// type instead. Which form uses which, and when the errors show, is in docs/validation.md.

/** The most yen or points a field takes. */
export const MAX_AMOUNT = 99_999_999;
export const MAX_QUANTITY = 999;
export const MAX_RATE = 100;

const grouped = (value: number) => value.toLocaleString("ja-JP");

const required = (label: string) => `${label}を入れてください`;

/** A whole number from `min` to `max`. */
function whole(label: string, min: number, max: number, unit = "") {
  const notWhole = `${label}は${grouped(min)}以上の整数で入れてください`;
  return v.pipe(
    v.number(notWhole),
    v.integer(notWhole),
    v.minValue(min, notWhole),
    v.maxValue(max, `${label}は${grouped(max)}${unit}以下で入れてください`),
  );
}

/** A rate from `min` (or above 0 when `min` is 0: a rate of 0 means nothing) to `MAX_RATE`. */
function rate(label: string, min: number) {
  const tooSmall =
    min === 0
      ? `${label}は0より大きい数で入れてください`
      : `${label}は${min}以上の数で入れてください`;
  return v.pipe(
    v.number(tooSmall),
    min === 0 ? v.gtValue(0, tooSmall) : v.minValue(min, tooSmall),
    v.maxValue(MAX_RATE, `${label}は${MAX_RATE}以下で入れてください`),
  );
}

/** A number field that must be filled in. */
const requiredNumber = <T>(unit: NumberUnit, label: string, rules: v.GenericSchema<number, T>) =>
  v.pipe(toNumber(unit), v.nonOptional(rules, required(label)));

/** A number field that may be left empty, which gives `undefined`. */
const optionalNumber = <T>(unit: NumberUnit, rules: v.GenericSchema<number, T>) =>
  v.pipe(toNumber(unit), v.optional(rules));

/** Yen, 0 or more. */
export const yenSchema = (label: string) =>
  requiredNumber("yen", label, whole(label, 0, MAX_AMOUNT, "円"));

/** Yen, or `undefined` for an empty field. */
export const optionalYenSchema = (label: string) =>
  optionalNumber("yen", whole(label, 0, MAX_AMOUNT, "円"));

/** Points, 0 or more. */
export const pointsSchema = (label: string) =>
  requiredNumber("points", label, whole(label, 0, MAX_AMOUNT, "ポイント"));

/** Points, or `undefined` for an empty field. */
export const optionalPointsSchema = (label: string) =>
  optionalNumber("points", whole(label, 0, MAX_AMOUNT, "ポイント"));

/** A campaign's rate (+N倍): above 0, up to `MAX_RATE`. */
export const rateSchema = (label: string) => requiredNumber("rate", label, rate(label, 0));

/** A date as YYYY-MM-DD, which a date field gives. */
export const dateSchema = (label: string) =>
  v.pipe(
    toDate,
    v.nonOptional(
      v.pipe(v.string(), v.isoDate(`${label}は YYYY-MM-DD の形で入れてください`)),
      required(label),
    ),
  );

export const END_BEFORE_START = "終了日は開始日と同じ日か、それより後の日にしてください";
export const START_AFTER_END = "開始日は終了日と同じ日か、それより前の日にしてください";

const maxLength = (label: string, max: number) =>
  v.maxLength<string, number, string>(max, `${label}は${max}文字以内で入れてください`);

/** Text that must be filled in, up to `max` characters. */
export const requiredTextSchema = (label: string, max: number) =>
  v.pipe(toText, v.nonEmpty(required(label)), maxLength(label, max));

/** Text that may be left empty, up to `max` characters. */
export const textSchema = (label: string, max: number) => v.pipe(toText, maxLength(label, max));

/** A web page's address, or `undefined` for an empty field. */
export const optionalUrlSchema = (label: string) =>
  v.pipe(
    toOptionalText,
    v.optional(
      v.pipe(
        v.string(),
        v.check(
          (text) => /^https?:\/\//i.test(text) && URL.canParse(text),
          `${label}は https:// で始まる形で入れてください`,
        ),
      ),
    ),
  );

// The fields of an order and its items.

export const AmountSchema = yenSchema("金額");

/** A coupon in yen; empty for none. */
export const DiscountSchema = v.pipe(
  toNumber("yen"),
  v.optional(whole("クーポン値引額", 0, MAX_AMOUNT, "円"), 0),
);

export const QuantitySchema = requiredNumber("quantity", "数量", whole("数量", 1, MAX_QUANTITY));

/** Empty for no rate of its own, or a rate of 1 or more. */
export const ShopRateSchema = optionalNumber("rate", rate("ショップ独自倍率", 1));

export const OrderDateSchema = dateSchema("注文日");

export const ItemNameSchema = textSchema("商品名メモ", 200);

export const ItemUrlSchema = optionalUrlSchema("商品のURL");

export const ShopNameSchema = requiredTextSchema("ショップの名前", 100);
