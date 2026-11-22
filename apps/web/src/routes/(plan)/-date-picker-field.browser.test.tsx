// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { Field as FormField, getInput, useForm } from "@formisch/react";
import { Field, UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { DateSchema } from "@workspaces/domain";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import * as v from "valibot";
import { errorsOf } from "#/routes/-form.tsx";
import { CommitDatePicker, FormDatePicker } from "./-date-picker-field.tsx";

function renderPicker(onCommit: (day: string) => Promise<unknown>) {
  return render(
    <UIProvider theme={theme} config={config}>
      <CommitDatePicker
        label="日付"
        initial="2026-11-19"
        schema={DateSchema("日付")}
        onCommit={onCommit}
      />
    </UIProvider>,
  );
}

/** Replaces what the field shows with `typed`, one key at a time, as a real keyboard does. */
async function typeDay(field: { click: () => Promise<void> }, typed: string) {
  await field.click();
  await userEvent.keyboard("{Control>}a{/Control}");
  await userEvent.keyboard(typed);
}

test("a day typed with slashes is saved as that day, not as another day", async () => {
  const onCommit = vi.fn<(day: string) => Promise<unknown>>().mockResolvedValue(undefined);
  const screen = await renderPicker(onCommit);
  const field = screen.getByRole("textbox", { name: "日付" });
  await expect.element(field).toHaveValue("2026/11/19");

  // Before the fix, the first keystroke alone was read as 2001/02/01 and saved.
  await typeDay(field, "2026/11/20");
  await expect.poll(() => onCommit.mock.calls).toEqual([["2026-11-20"]]);
  await expect.element(field).toHaveValue("2026/11/20");
});

test("a day typed with hyphens is saved as that day", async () => {
  const onCommit = vi.fn<(day: string) => Promise<unknown>>().mockResolvedValue(undefined);
  const screen = await renderPicker(onCommit);
  const field = screen.getByRole("textbox", { name: "日付" });

  await typeDay(field, "2026-11-21");
  await expect.poll(() => onCommit.mock.calls).toEqual([["2026-11-21"]]);
  await expect.element(field).toHaveValue("2026/11/21");
});

const FormSchema = v.object({ date: v.string() });

/** A `FormDatePicker` in a Formisch form holding `2026-10-05`, with a button that reads it. */
function DateForm({ onRead }: { onRead: (input: unknown) => void }) {
  const form = useForm({ schema: FormSchema, initialInput: { date: "2026-10-05" } });
  return (
    <UIProvider theme={theme} config={config}>
      <FormField of={form} path={["date"]}>
        {(field) => (
          <Field.Root label="注文日" {...errorsOf(field)} minW="0">
            <FormDatePicker size="lg" field={field} />
          </Field.Root>
        )}
      </FormField>
      <button type="button" onClick={() => onRead(getInput(form))}>
        読み取る
      </button>
    </UIProvider>
  );
}

test("a day typed into a form is the form's input after the field is left", async () => {
  let read: unknown;
  const screen = await render(<DateForm onRead={(input) => (read = input)} />);
  const field = screen.getByLabelText("注文日");
  await expect.element(field).toHaveValue("2026/10/05");

  await field.fill("2026/10/07");
  // Leaving the field must not put the day it held before back into the form.
  await screen.getByRole("button", { name: "読み取る" }).click();
  expect(read).toEqual({ date: "2026-10-07" });
  await expect.element(field).toHaveValue("2026/10/07");
});

test("a day that does not exist is not saved, and the field goes back to the saved day", async () => {
  const onCommit = vi.fn<(day: string) => Promise<unknown>>().mockResolvedValue(undefined);
  const screen = await renderPicker(onCommit);
  const field = screen.getByRole("textbox", { name: "日付" });

  await typeDay(field, "2026/13/40");
  await field.element().blur();
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(onCommit).not.toHaveBeenCalled();
  await expect.element(field).toHaveValue("2026/11/19");
});
