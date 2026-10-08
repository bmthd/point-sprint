import * as v from "valibot";

// How the text typed into a field becomes a value, before it is checked. Every form's field goes
// through one of these, and nothing here is an error: what cannot be read becomes a value the
// field's rules refuse (`NaN`), and an empty field becomes `undefined` for the rules to ask for it.
// The rules and their messages are in field-schemas.ts.

/** The signs typed around a number that are dropped, by what it counts. */
const UNITS = {
  yen: /^¥|円$/g,
  points: /P$|ポイント$/gi,
  rate: /^\+|倍$/g,
  quantity: /個$/g,
} as const;

export type NumberUnit = keyof typeof UNITS;

/** Plain digits, with a sign and a decimal part; anything else is not read as a number. */
const NUMBER = /^[+-]?\d+(\.\d+)?$/;

/**
 * A number. Full-width digits and signs become half-width (NFKC), and the spaces, the digit-group
 * commas and the unit's signs are dropped: 「¥１１，０００」 is 11000, 「+3倍」 is 3.
 */
export const toNumber = (unit: NumberUnit) =>
  v.pipe(
    v.string(),
    v.normalize("NFKC"),
    v.transform((text) => text.replace(/[,\s]/g, "").replace(UNITS[unit], "")),
    v.transform((text) => (text === "" ? undefined : NUMBER.test(text) ? Number(text) : NaN)),
  );

/** A date field's YYYY-MM-DD, made half-width and without the spaces around it. */
export const toDate = v.pipe(
  v.string(),
  v.normalize("NFKC"),
  v.trim(),
  v.transform((text) => (text === "" ? undefined : text)),
);

/** Text without the spaces around it. An empty field stays an empty string. */
export const toText = v.pipe(v.string(), v.trim());

/** Text without the spaces around it, or `undefined` for an empty field. */
export const toOptionalText = v.pipe(
  toText,
  v.transform((text) => (text === "" ? undefined : text)),
);
