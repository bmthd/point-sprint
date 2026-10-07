import { UIProvider } from "@workspaces/ui";
import { config, theme } from "@workspaces/ui/theme";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";
import { CommitField } from "./commit-field";
import { AmountSchema } from "./field-schemas";

function renderField(onCommit: (amount: number) => Promise<unknown>) {
  return render(
    <UIProvider theme={theme} config={config}>
      <CommitField label="金額（税込）" initial="1,000" schema={AmountSchema} onCommit={onCommit} />
    </UIProvider>,
  );
}

test("a commit that failed can be made again with the same text", async () => {
  const onCommit = vi
    .fn<(amount: number) => Promise<unknown>>()
    .mockRejectedValueOnce(new Error("disk full"))
    .mockResolvedValue(undefined);
  const screen = await renderField(onCommit);

  const field = screen.getByRole("textbox", { name: "金額（税込）" });
  await field.fill("2,000");
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => onCommit.mock.calls.length).toBe(1);
  // Let the rejection settle before committing the same text again.
  await new Promise((resolve) => setTimeout(resolve, 0));

  await userEvent.keyboard("{Enter}");
  await expect.poll(() => onCommit.mock.calls.length).toBe(2);
  expect(onCommit).toHaveBeenLastCalledWith(2000);

  // Once saved, the same text is not saved again.
  await userEvent.keyboard("{Enter}");
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(onCommit).toHaveBeenCalledTimes(2);
});

test("a value its schema refuses shows the error when the field is left, and is not saved", async () => {
  const onCommit = vi.fn<(amount: number) => Promise<unknown>>().mockResolvedValue(undefined);
  const screen = await renderField(onCommit);
  const field = screen.getByRole("textbox", { name: "金額（税込）" });

  // No error while typing a value for the first time.
  await field.fill("12a");
  await expect.element(field).not.toHaveAttribute("aria-invalid");
  await field.element().blur();
  await expect.element(field).toHaveAccessibleDescription("金額は0以上の整数で入れてください");
  expect(onCommit).not.toHaveBeenCalled();

  // Once shown, the error follows each input.
  await field.fill("");
  await expect.element(field).toHaveAccessibleDescription("金額を入れてください");
  await field.fill("１２，０００");
  await expect.element(field).not.toHaveAttribute("aria-invalid");
  await userEvent.keyboard("{Enter}");
  await expect.poll(() => onCommit.mock.calls).toEqual([[12000]]);
});

test("Escape puts the saved value back", async () => {
  const onCommit = vi.fn<(amount: number) => Promise<unknown>>().mockResolvedValue(undefined);
  const screen = await renderField(onCommit);
  const field = screen.getByRole("textbox", { name: "金額（税込）" });
  await field.fill("abc");
  await field.element().blur();
  await expect.element(field).toHaveAttribute("aria-invalid", "true");

  await field.click();
  await userEvent.keyboard("{Escape}");
  await expect.element(field).toHaveValue("1,000");
  await expect.element(field).not.toHaveAttribute("aria-invalid");
  expect(onCommit).not.toHaveBeenCalled();
});
