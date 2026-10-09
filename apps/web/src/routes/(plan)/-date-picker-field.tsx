// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import type { FieldElementProps } from "@formisch/react";
import { DatePicker, type DatePickerProps, useFieldProps } from "@workspaces/ui";
import * as v from "valibot";
import { dateSchema } from "../../form/field-schemas";

const DateText = dateSchema("日付");

/** Whether `text` is a day as the forms hold it: `2026-10-06`. */
export const isDate = (text: unknown): text is string => v.is(DateText, text);

/** `2026-10-06` → that day at midnight here, or `undefined` for anything else. */
export const parseIsoDate = (text: unknown) => {
  if (!isDate(text)) return undefined;
  const [year, month, day] = text.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day);
};

/** A day → `2026-10-06`, the text the form's date fields hold. */
export const isoDate = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

/** How a date field shows its day: `2026/10/06`. */
const DATE_FORMAT = { input: { year: "numeric", month: "2-digit", day: "2-digit" } } as const;

/**
 * A `DatePicker` in a `Field`: a day typed in, or picked from the calendar that opens when the
 * field is tapped. Focusing or typing does not open the calendar, so moving the focus to an error
 * does not cover the form with it. The picker puts the field's `aria-invalid` and error description
 * on its box, not on the input that has the label, so they are given to the input as well.
 */
export function FieldDatePicker(props: DatePickerProps) {
  const { ariaProps } = useFieldProps();
  return (
    <DatePicker
      locale="ja"
      format={DATE_FORMAT}
      placeholder="YYYY/MM/DD"
      openOnFocus={false}
      openOnChange={false}
      fontVariantNumeric="tabular-nums"
      // The input keeps its own width otherwise, too wide for half of a row.
      minW="0"
      // A tap brings up the calendar alone, not the on-screen keyboard as well. A real keyboard can
      // still type a day.
      inputProps={{ ...ariaProps, minW: "0", inputMode: "none" }}
      {...props}
    />
  );
}

/** What a Formisch field of a `2026-10-06` text gives to its render function. */
type DateFieldState = {
  input: unknown;
  props: FieldElementProps;
  onChange: (input: string) => void;
};

/** A `FieldDatePicker` bound to a Formisch field that holds the day as `2026-10-06`. */
export function FormDatePicker({
  field,
  ...props
}: Omit<DatePickerProps, "value" | "onChange"> & { field: DateFieldState }) {
  const { name, ref, onBlur } = field.props;
  return (
    <FieldDatePicker
      ref={ref}
      name={name}
      value={parseIsoDate(field.input)}
      onChange={(date) => field.onChange(date ? isoDate(date) : "")}
      onBlur={onBlur}
      {...props}
    />
  );
}
