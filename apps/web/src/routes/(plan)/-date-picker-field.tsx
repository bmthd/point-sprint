// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import type { FieldElementProps } from "@formisch/react";
import type { Plan } from "@workspaces/domain";
import {
  Box,
  DatePicker,
  type DatePickerProps,
  Field,
  isComposing,
  useFieldProps,
} from "@workspaces/ui";
import { useEffect, useRef, useState } from "react";
import * as v from "valibot";
import { DateSchema } from "@workspaces/domain";

const DateText = DateSchema("日付");

/** Whether `text` is a day as the forms hold it: `2026-10-06`. */
export function isDate(text: unknown): text is string {
  return v.is(DateText, text);
}

/**
 * A day typed into a date field: `2026/11/20` or `2026-11-20`, a 4-digit year and a day that
 * exists in its month. Full-width digits are read as half-width ones. Anything else — a day
 * still being typed, a day that does not exist — is `undefined`, never another day. The picker
 * itself reads typed text loosely (a lone `2` becomes 2001/02/01) and rewrites the field with
 * what it read, so typed text is judged here instead and only a day that passes is handed on.
 */
export function parseTypedDate(text: string): Date | undefined {
  const halfWidth = text.replace(/[０-９]/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) - 0xfee0),
  );
  const match = /^(\d{4})([/-])(\d{1,2})\2(\d{1,2})$/.exec(halfWidth.trim());
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[3]);
  const day = Number(match[4]);
  const date = new Date(year, month - 1, day);
  // A day that does not exist rolls over into the next month (Feb 30 → Mar 2); that is not it.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined;
  }
  return date;
}

/** A typed day in its full form, the only one taken while it is still being typed. */
const TYPED_DAY = /^\d{4}[/-]\d{2}[/-]\d{2}$/;

/** `2026-10-06` → that day at midnight here, or `undefined` for anything else. */
export function parseIsoDate(text: unknown) {
  if (!isDate(text)) return undefined;
  const [year, month, day] = text.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day);
}

/** A day → `2026-10-06`, the text the form's date fields hold. */
export function isoDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** How a date field shows its day: `2026/10/06`. */
const DATE_FORMAT = { input: { year: "numeric", month: "2-digit", day: "2-digit" } } as const;

/** The days of an event, as a plan holds them: `2026-10-04` to `2026-10-09`. */
type Period = Plan["period"];

/**
 * A day of the calendar inside `period`, on a pale face. A selected day keeps the picker's own
 * solid face. Days outside it are left to the picker.
 */
const periodDay =
  (period: Period) =>
  ({ value }: { value: Date }) => {
    const day = isoDate(value);
    if (day < period.start || day > period.end) return undefined;
    return (
      <Box
        as="span"
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        boxSize="full"
        rounded="{cell-rounded}"
        bg="primary.subtle"
        _groupSelected={{ bg: "transparent" }}
      >
        {value.getDate()}
      </Box>
    );
  };

/**
 * A `DatePicker` in a `Field`: a day typed in, or picked from the calendar that opens when the
 * field is tapped. Focusing or typing does not open the calendar, so moving the focus to an error
 * does not cover the form with it. The picker puts the field's `aria-invalid` and error description
 * on its box, not on the input that has the label, so they are given to the input as well.
 */
export function FieldDatePicker(allProps: DatePickerProps & { period?: Period }) {
  // The field keeps its own text (see below), so `inputValue` is not taken from the caller: the
  // `inputValue` below is spread after the caller's props, so it wins.
  const { period, value, defaultValue, onChange, onInputChange, inputProps, ...props } = allProps;
  const { ariaProps } = useFieldProps();
  const controlled = "value" in allProps;
  // The text in the field, while it is being typed. `undefined` when nobody is typing: the field
  // then shows the day it holds, formatted. Typed text is kept exactly as typed until it names a
  // day (see parseTypedDate), so a half-typed day is never rewritten into another day.
  const [text, setText] = useState<string>();
  // The day an uncontrolled field holds, followed here because its text is derived from it.
  const [ownDay, setOwnDay] = useState<Date | undefined>(
    defaultValue instanceof Date ? defaultValue : undefined,
  );
  const shown = controlled ? value : ownDay;
  // The day last handed on, readable inside the picker's own callbacks within the same event,
  // before any state has settled.
  const dayRef = useRef<Date | undefined>(shown);

  // A day changed elsewhere (a form reset, an autofill) replaces what the field shows. Compared
  // by day, not by object: a controlled field builds a new Date for the same day on each render.
  const valueDay = value ? isoDate(value) : "";
  const [shownDay, setShownDay] = useState(valueDay);
  if (valueDay !== shownDay) {
    setShownDay(valueDay);
    setText(undefined);
  }

  // Follows the controlled day from outside (a form reset, an autofill), for the guard below.
  useEffect(() => {
    dayRef.current = value;
  }, [value]);

  const commit = (date: Date | undefined) => {
    dayRef.current = date;
    if (!controlled) setOwnDay(date);
    // The field now shows this day, formatted, not the text that was typed for it. The caller
    // does not necessarily render this field again with the new day — a Formisch form keeps its
    // input in its own store and saves from there — so the field puts the day on screen itself.
    setText(date ? isoDate(date).replaceAll("-", "/") : "");
    onChange?.(date);
  };

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
      {...props}
      value={value}
      defaultValue={defaultValue}
      onChange={commit}
      inputValue={text ?? (shown ? isoDate(shown).replaceAll("-", "/") : "")}
      onInputChange={(input) => {
        // The picker itself rewrites the text when a day is picked, cleared or left: follow it.
        // Except on blur, when it rewrites the text with the day it still holds — one a typed
        // day was just handed on over. That rewrite would put the old day back on screen.
        const rewritten =
          typeof input === "string" && input !== "" ? parseTypedDate(input) : undefined;
        // The day this field holds is the one last handed on (or given from outside), which
        // `commit` and the effect above keep in dayRef, ahead of the picker's own state.
        const held = dayRef.current;
        if (!rewritten || !held || isoDate(rewritten) === isoDate(held)) {
          setText(typeof input === "string" ? input : undefined);
        }
        onInputChange?.(input);
      }}
      // A tap brings up the calendar alone, not the on-screen keyboard as well. A real keyboard can
      // still type a day.
      inputProps={{
        ...ariaProps,
        ...inputProps,
        minW: "0",
        inputMode: "none",
        onChange: (event) => {
          inputProps?.onChange?.(event);
          // Keep the picker's own reading of typed text out of this: it reads a half-typed day
          // as another day and rewrites the field with it (see parseTypedDate).
          event.preventDefault();
          const typed = event.target.value;
          setText(typed);
          if (typed.trim() === "") commit(undefined);
          else if (TYPED_DAY.test(typed.trim())) {
            const date = parseTypedDate(typed);
            if (date) commit(date);
          }
        },
        onKeyDown: (event) => {
          inputProps?.onKeyDown?.(event);
          if (event.key !== "Enter" || isComposing(event)) return;
          const typed = event.currentTarget.value;
          if (typed.trim() === "") return;
          // Enter does not hand a day this field cannot read to the picker's loose reading.
          event.preventDefault();
          const date = parseTypedDate(typed);
          if (date) commit(date);
        },
        onBlur: (event) => {
          inputProps?.onBlur?.(event);
          // A day typed with a one-digit month or day is taken when the field is left. A day
          // that cannot be read is not taken, and the field goes back to the day it holds.
          const date = parseTypedDate(event.currentTarget.value);
          if (date) commit(date);
        },
      }}
      calendarProps={
        period ? { day: periodDay(period), dayProps: { "data-group": "" } } : undefined
      }
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
}: Omit<Parameters<typeof FieldDatePicker>[0], "value" | "onChange"> & {
  field: DateFieldState;
}) {
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

/**
 * A `FieldDatePicker` with its label that saves a day as soon as it is picked or typed in, and only
 * when `schema` accepts it. Its error shows until a day it accepts is chosen. Give it a `key` of the
 * saved day, and of anything its schema checks against, so it follows changes made elsewhere.
 */
export function CommitDatePicker<T>({
  label,
  initial,
  schema,
  onCommit,
  period,
}: {
  label: string;
  /** The saved day, as `2026-10-06`. */
  initial: string;
  schema: v.GenericSchema<string, T>;
  /** Saves the day; a rejected promise means it was not saved. */
  onCommit: (value: T) => Promise<unknown>;
  /** The event's days, marked on the calendar. */
  period?: Period;
}) {
  const [error, setError] = useState<string>();
  return (
    <Field.Root label={label} invalid={error !== undefined} errorMessage={error} minW="0">
      <FieldDatePicker
        size="lg"
        period={period}
        defaultValue={parseIsoDate(initial)}
        onChange={(date) => {
          const text = date ? isoDate(date) : "";
          const parsed = v.safeParse(schema, text);
          setError(parsed.success ? undefined : parsed.issues[0].message);
          if (parsed.success && text !== initial) void onCommit(parsed.output).catch(() => {});
        }}
      />
    </Field.Root>
  );
}
