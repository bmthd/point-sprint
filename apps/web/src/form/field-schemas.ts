import * as v from "valibot";

// The schemas of what is typed into the forms, shared by every form. Each takes the text of its
// field, normalizes it, and gives the value to save. A message names the field and says what to
// type instead. Which form uses which, and when the errors show, is in docs/validation.md.

/** Full-width digits and letters made half-width, and the spaces around removed. */
export const normalizeText = (text: string) => text.normalize("NFKC").trim();

/** The most yen or points a field takes. */
export const MAX_AMOUNT = 99_999_999;
export const MAX_QUANTITY = 999;
export const MAX_RATE = 100;

const grouped = (value: number) => value.toLocaleString("ja-JP");

/** A test of a field's normalized text, and what to tell the user when it fails. */
type Rule = readonly [test: (text: string) => boolean, message: string];

type NumberSpec = {
  label: string;
  /** The signs typed around the number that are dropped (「¥」, 「円」, 「P」, 「倍」). */
  units: RegExp;
  rules: readonly [Rule, Rule];
};

function numberSpec(
  label: string,
  units: RegExp,
  kind: "whole" | "decimal",
  min: number,
  max: number,
  unit = "",
): NumberSpec {
  const pattern = kind === "whole" ? /^\d+$/ : /^\d+(\.\d+)?$/;
  const noun = kind === "whole" ? "整数" : "数";
  // A rate of 0 means nothing, so a rate's lowest bound is excluded when it is 0.
  const aboveMin = (value: number) => (kind === "decimal" && min === 0 ? value > 0 : value >= min);
  const tooSmall =
    kind === "decimal" && min === 0
      ? `${label}は0より大きい数で入れてください`
      : `${label}は${grouped(min)}以上の${noun}で入れてください`;
  return {
    label,
    units,
    rules: [
      [(text) => pattern.test(text) && aboveMin(Number(text)), tooSmall],
      // Text that is not a number fails only the first rule.
      [(text) => !(Number(text) > max), `${label}は${grouped(max)}${unit}以下で入れてください`],
    ],
  };
}

/** The text of a number: normalized, without digit-group commas, spaces and unit signs. */
const numberText = (units: RegExp) => (text: string) =>
  normalizeText(text).replace(/[,\s]/g, "").replace(units, "");

/** A number that must be filled in. */
function requiredNumber({ label, units, rules: [first, second] }: NumberSpec) {
  return v.pipe(
    v.string(),
    v.transform(numberText(units)),
    v.nonEmpty(`${label}を入れてください`),
    v.check(...first),
    v.check(...second),
    v.transform(Number),
  );
}

/** A number, or `undefined` for an empty field. */
function optionalNumber({ units, rules: [first, second] }: NumberSpec) {
  const orEmpty = ([test, message]: Rule) =>
    v.check((text: string) => text === "" || test(text), message);
  return v.pipe(
    v.string(),
    v.transform(numberText(units)),
    orEmpty(first),
    orEmpty(second),
    v.transform((text) => (text === "" ? undefined : Number(text))),
  );
}

const YEN = /^¥|円$/g;
const POINTS = /P$|ポイント$/gi;
const RATE = /^\+|倍$/g;

const yen = (label: string) => numberSpec(label, YEN, "whole", 0, MAX_AMOUNT, "円");
const points = (label: string) => numberSpec(label, POINTS, "whole", 0, MAX_AMOUNT, "ポイント");

/** Yen, 0 or more. Takes full-width digits, commas, 「¥」 and 「円」. */
export const yenSchema = (label: string) => requiredNumber(yen(label));

/** Yen, or `undefined` for an empty field. */
export const optionalYenSchema = (label: string) => optionalNumber(yen(label));

/** Points, 0 or more. Takes full-width digits, commas and 「P」. */
export const pointsSchema = (label: string) => requiredNumber(points(label));

/** Points, or `undefined` for an empty field. */
export const optionalPointsSchema = (label: string) => optionalNumber(points(label));

/** A campaign's rate (+N倍): above 0, up to `MAX_RATE`. Takes 「+2」 and 「2倍」. */
export const rateSchema = (label: string) =>
  requiredNumber(numberSpec(label, RATE, "decimal", 0, MAX_RATE));

/** A date as YYYY-MM-DD, which a date field gives. */
export const dateSchema = (label: string) =>
  v.pipe(
    v.string(),
    v.transform(normalizeText),
    v.nonEmpty(`${label}を入れてください`),
    v.isoDate(`${label}は YYYY-MM-DD の形で入れてください`),
  );

export const END_BEFORE_START = "終了日は開始日と同じ日か、それより後の日にしてください";
export const START_AFTER_END = "開始日は終了日と同じ日か、それより前の日にしてください";

/** Text that must be filled in, up to `max` characters. */
export const requiredTextSchema = (label: string, max: number) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(`${label}を入れてください`),
    v.maxLength(max, `${label}は${max}文字以内で入れてください`),
  );

/** Text that may be left empty, up to `max` characters. */
export const textSchema = (label: string, max: number) =>
  v.pipe(v.string(), v.trim(), v.maxLength(max, `${label}は${max}文字以内で入れてください`));

/** A web page's address, or `undefined` for an empty field. */
export const optionalUrlSchema = (label: string) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.check(
      (text) => text === "" || (/^https?:\/\//i.test(text) && URL.canParse(text)),
      `${label}は https:// で始まる形で入れてください`,
    ),
    v.transform((text) => (text === "" ? undefined : text)),
  );

// The fields of an order and its items.

export const AmountSchema = yenSchema("金額");

/** A coupon in yen; empty for none. */
export const DiscountSchema = v.pipe(
  optionalYenSchema("クーポン値引額"),
  v.transform((value) => value ?? 0),
);

export const QuantitySchema = requiredNumber(numberSpec("数量", /個$/g, "whole", 1, MAX_QUANTITY));

/** Empty for no rate of its own, or a rate of 1 or more. */
export const ShopRateSchema = optionalNumber(
  numberSpec("ショップ独自倍率", RATE, "decimal", 1, MAX_RATE),
);

export const OrderDateSchema = dateSchema("注文日");

export const ItemNameSchema = textSchema("商品名メモ", 200);

export const ItemUrlSchema = optionalUrlSchema("商品のURL");

export const ShopNameSchema = requiredTextSchema("ショップの名前", 100);
