import {
  DatePickerPropsContext,
  InputPropsContext,
  NativeSelectPropsContext,
  SegmentedControlPropsContext,
  TextareaPropsContext,
} from "@workspaces/ui";
import type { ReactNode } from "react";

/**
 * The look of every text field, select and date field, as in docs/design-system.md: the `bg.panel`
 * face and the `border.emphasized` frame. Yamada UI's `outline` variant fills its face only inside a
 * `panel` fieldset and frames it with `border`, so on the page or an outline card the gray behind
 * shows through. The frame of a field in error stays red.
 *
 * For now only: remove this once the Yamada UI CLI can override part of a component's style. Its
 * `add` copies the input and every component built on its style (23 of them) to change one variant.
 */
const fieldStyle = {
  bg: "bg.panel",
  borderColor: "border.emphasized",
  _invalid: { borderColor: "border.error" },
} as const;

/**
 * The look of every segmented control, as in docs/design-system.md: Yamada UI's white choice on a
 * gray track, the track darker so the chosen one stands out on a white card, its label bold and the
 * others faint. The bold is a thin outline of the letters, not a bolder font: a bolder font is wider
 * (「10%」 by about 1px) and would move the control each time the choice changes.
 *
 * For now only, as `fieldStyle` is.
 */
const segmentStyle = {
  bg: "bg.emphasized",
  indicatorProps: {
    bg: "bg.panel",
    boxShadow: "sm",
    // The chosen one moves at once, without sliding from the one chosen before.
    transition: { duration: 0 },
  },
  itemProps: {
    color: "fg.muted",
    _checked: { color: "fg", WebkitTextStroke: "0.035em currentColor" },
  },
} as const;

export function FormControlDefaults({ children }: { children: ReactNode }) {
  return (
    <InputPropsContext value={fieldStyle}>
      <TextareaPropsContext value={fieldStyle}>
        <NativeSelectPropsContext value={fieldStyle}>
          <DatePickerPropsContext value={fieldStyle}>
            <SegmentedControlPropsContext value={segmentStyle}>
              {children}
            </SegmentedControlPropsContext>
          </DatePickerPropsContext>
        </NativeSelectPropsContext>
      </TextareaPropsContext>
    </InputPropsContext>
  );
}
