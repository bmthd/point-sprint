// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { getInput, reset, useField, useForm, validate } from "@formisch/react";
import { Field, Input, VisuallyHidden } from "@workspaces/ui";
import { useRef } from "react";
import * as v from "valibot";
import { bind, errorsOf } from "./form";

/**
 * A text field that saves its value on Enter or when it loses the focus, and only when `schema`
 * accepts it. Its error shows when it loses the focus, and follows each input after that. Escape
 * puts the saved value back. Give it a `key` of the saved value, and of anything its schema
 * checks against, so it follows changes made elsewhere.
 */
export function CommitField<T>({
  label,
  hideLabel = false,
  initial,
  schema,
  onCommit,
  inputMode,
  align = "start",
  placeholder,
}: {
  label: string;
  /** Leaves the label to screen readers, for a field whose row already says what it is. */
  hideLabel?: boolean;
  initial: string;
  schema: v.GenericSchema<string, T>;
  /** Saves the value; a rejected promise means it was not saved. */
  onCommit: (value: T) => Promise<unknown>;
  inputMode?: "numeric" | "decimal" | "text";
  align?: "start" | "end";
  placeholder?: string;
}) {
  const form = useForm({
    schema: v.object({ value: schema }),
    initialInput: { value: initial },
    validate: "blur",
    revalidate: "input",
  });
  const field = useField(form, { path: ["value"] });
  // What was last saved (or is being saved), so a blur right after Enter does not save the same
  // value again. A failed save forgets it, so the same text can be tried again.
  const committed = useRef(initial);

  const commit = async () => {
    const text = getInput(form, { path: ["value"] }) ?? "";
    const result = await validate(form);
    if (!result.success || text === committed.current) return;
    const previous = committed.current;
    committed.current = text;
    onCommit(result.output.value).catch(() => {
      if (committed.current === text) committed.current = previous;
    });
  };

  return (
    <Field.Root
      label={hideLabel ? <VisuallyHidden>{label}</VisuallyHidden> : label}
      {...errorsOf(field)}
      minW="0"
    >
      <Input
        size="lg"
        inputMode={inputMode}
        placeholder={placeholder}
        fontVariantNumeric={align === "end" ? "tabular-nums" : undefined}
        {...bind(field)}
        onBlur={() => {
          field.props.onBlur();
          void commit();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) void commit();
          if (event.key === "Escape") reset(form);
        }}
      />
    </Field.Root>
  );
}
