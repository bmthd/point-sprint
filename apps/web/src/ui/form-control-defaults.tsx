import {
  DatePickerPropsContext,
  InputPropsContext,
  NativeSelectPropsContext,
  TextareaPropsContext,
} from "@workspaces/ui";
import type { ReactNode } from "react";

/**
 * The look of every text field, select and date field, as in docs/design-system.md: the `bg.panel`
 * face and the `border.emphasized` frame. Yamada UI's `outline` variant fills its face only inside a
 * `panel` fieldset and frames it with `border`, so on the page or an outline card the gray behind
 * shows through. The frame of a field in error stays red.
 */
const fieldStyle = {
  bg: "bg.panel",
  borderColor: "border.emphasized",
  _invalid: { borderColor: "border.error" },
} as const;

export function FormControlDefaults({ children }: { children: ReactNode }) {
  return (
    <InputPropsContext value={fieldStyle}>
      <TextareaPropsContext value={fieldStyle}>
        <NativeSelectPropsContext value={fieldStyle}>
          <DatePickerPropsContext value={fieldStyle}>{children}</DatePickerPropsContext>
        </NativeSelectPropsContext>
      </TextareaPropsContext>
    </InputPropsContext>
  );
}
