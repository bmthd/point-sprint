import {
  type FieldElementProps,
  type FormSchema,
  type FormStore,
  type SubmitEventHandler,
  handleSubmit,
  isValid,
} from "@formisch/react";
import type { ComponentProps } from "react";

// How the forms put Formisch's fields into Yamada UI's: every form validates when it is sent, then
// again on each input of a field with an error. See docs/validation.md.

/** What a Formisch field gives to its render function. */
export type FieldState = {
  input: unknown;
  errors: [string, ...string[]] | null;
  props: FieldElementProps;
};

/** The props of a Formisch text field for an `Input`, a `Textarea` or a `NativeSelect`. */
export const bind = (field: FieldState) => ({
  ...field.props,
  value: typeof field.input === "string" ? field.input : "",
});

/**
 * `Field`'s props for a Formisch field: the first error under it. The error is announced as the
 * input's description, and the input is marked invalid.
 */
export const errorsOf = (field: FieldState) => ({
  invalid: field.errors !== null,
  errorMessage: field.errors?.[0],
});

/**
 * Moves the focus to the first field marked invalid, in the order of the page, opening the
 * `details` it is in. Formisch focuses the first field of its schema, which may be in a closed
 * `details` and so cannot take the focus. Waits a frame for the errors to be drawn.
 */
export async function focusFirstError(container: HTMLElement) {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  // Only the controls: a `DatePicker` also marks the box around its input invalid.
  const field = container.querySelector<HTMLElement>(
    ":is(input, select, textarea)[aria-invalid='true']",
  );
  if (!field) return;
  const details = field.closest("details");
  if (details) details.open = true;
  field.focus();
}

type FormProps<TSchema extends FormSchema> = Omit<
  ComponentProps<"form">,
  "onSubmit" | "noValidate"
> & {
  of: FormStore<TSchema>;
  onSubmit: SubmitEventHandler<TSchema>;
};

/**
 * A form that validates its fields when it is sent, then calls `onSubmit` with the valid values
 * or moves the focus to the first field with an error. A plain form element: Yamada UI's `Form`
 * comes with its own layout and footer.
 */
export function Form<TSchema extends FormSchema>({ of, onSubmit, ...other }: FormProps<TSchema>) {
  return (
    <form
      {...other}
      noValidate
      onSubmit={async (event) => {
        const element = event.currentTarget;
        await handleSubmit(of, onSubmit)(event);
        if (!isValid(of)) await focusFirstError(element);
      }}
    />
  );
}
