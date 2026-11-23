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
export function NumberInputSchema(unit: NumberUnit) {
  return v.pipe(
    v.string(),
    v.normalize("NFKC"),
    v.transform((text) => text.replace(/[,\s]/g, "").replace(UNITS[unit], "")),
    v.transform((text) => (text === "" ? undefined : NUMBER.test(text) ? Number(text) : NaN)),
  );
}

/** A date field's YYYY-MM-DD, made half-width and without the spaces around it. */
export const DateInputSchema = v.pipe(
  v.string(),
  v.normalize("NFKC"),
  v.trim(),
  v.transform((text) => (text === "" ? undefined : text)),
);

/** A day typed with slashes or hyphens, its month and day in 1 or 2 digits. */
const TYPED_DAY = /^(\d{4})([/-])(\d{1,2})\2(\d{1,2})$/;

/**
 * A day typed into a date field, as its YYYY-MM-DD: `2026/11/20` and `2026-11-20` are both
 * 2026-11-20, and full-width text is made half-width (NFKC). Text that does not name a day
 * that exists — a day still being typed, Feb 30 — becomes `undefined`, never another day.
 */
export const TypedDateInputSchema = v.pipe(
  v.string(),
  v.normalize("NFKC"),
  v.trim(),
  v.transform((text) => {
    const match = TYPED_DAY.exec(text);
    if (!match) return undefined;
    const year = Number(match[1]);
    const month = Number(match[3]);
    const day = Number(match[4]);
    const date = new Date(year, month - 1, day);
    // A day that does not exist rolls over into the next month (Feb 30 → Mar 2); that is not it.
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return undefined;
    }
    return `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }),
);

/** Text without the spaces around it. An empty field stays an empty string. */
export const TextInputSchema = v.pipe(v.string(), v.trim());

/** Text without the spaces around it, or `undefined` for an empty field. */
export const OptionalTextInputSchema = v.pipe(
  TextInputSchema,
  v.transform((text) => (text === "" ? undefined : text)),
);
