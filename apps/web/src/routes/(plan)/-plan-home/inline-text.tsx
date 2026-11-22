// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { setErrors, setInput, useField } from "@formisch/react";
import { Box, Editable, IconButton, Text, dataAttr, isComposing, mergeRefs } from "@workspaces/ui";
import {
  type ClipboardEvent,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useId,
  useRef,
  useState,
} from "react";
import {
  AMOUNT_PATH,
  NAME_PATH,
  type OrderForm,
  urlFromPastedText,
} from "#/routes/(plan)/-order-form-store.ts";
import { ChevronIcon } from "#/ui/icons.tsx";

// The parts of the desktop table's rows that the orders' rows and the add row share: the 40px
// input that floats over its column, the text that turns into it, and the ⌄ that opens a row.

/** What saving a field's change came to. Only `invalid` and `failed` keep the change unsaved. */
export type CommitResult = "saved" | "unchanged" | "invalid" | "failed" | "pending";

/** Where a column's input reaches past the column: 9px past its text, as far as the text's own surface. */
export type FloatInset = { start: string; end: string };

/** The item's name reaches left over the number's column, and ends at its own column's end. */
export const NAME_INSET: FloatInset = { start: "-9px", end: "0px" };
/** The amount reaches right, its digits ending where the text's did. */
export const AMOUNT_INSET: FloatInset = { start: "-4px", end: "-9px" };
/** The widths of the amount's and the points' columns, and the gap between a row's columns (`rowColumns`). */
export const AMOUNT_COLUMN = "6rem";
export const POINTS_COLUMN = "5.5rem";
export const ROW_GAP = "2.5";
/** Typed long, the name grows over the amount's and the points' columns, up to the ⌄. */
const GROW_REACH = `${AMOUNT_COLUMN} + ${POINTS_COLUMN} + 2 * {spaces.${ROW_GAP}}`;

/**
 * The 40px input over the middle of its column, which spans the row's 64px: it covers the small
 * lines above and below the column's main line, and nothing in the row moves. Its text starts
 * where the column's text does.
 */
export function floatingInputProps(inset: FloatInset, align: "start" | "end") {
  const columnWidth = `calc(100% - ${inset.start} - ${inset.end})`;
  return {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    insetInlineStart: inset.start,
    insetInlineEnd: inset.end,
    w: "auto",
    css: {
      "&[data-grow]:focus": {
        insetInlineEnd: "auto",
        // Over the amount's input, which comes after it.
        zIndex: "3",
        fieldSizing: "content",
        minW: columnWidth,
        maxW: `calc(${columnWidth} + ${GROW_REACH})`,
      },
    },
    h: "10",
    minH: "10",
    px: "2",
    zIndex: "2",
    fontSize: "sm",
    bg: "bg.panel",
    textAlign: align,
    fontVariantNumeric: align === "end" ? "tabular-nums" : undefined,
    // Typing is shown in the text color, not red: red is kept for a value that is wrong.
    _focus: { borderColor: "mono.outline" },
    _invalid: { borderColor: "border.error", _focus: { borderColor: "border.error" } },
  } as const;
}

/**
 * The box of a row's text that turns into the floating input: as wide as the input, its text where
 * the input's starts, one line high.
 */
export function textBoxProps(inset: FloatInset) {
  const width = `calc(100% - ${inset.start} - ${inset.end})`;
  return {
    display: "block",
    w: width,
    maxW: width,
    h: "22px",
    ms: inset.start,
    me: inset.end,
    px: "2",
    borderWidth: "1px",
    borderColor: "transparent",
    rounded: "l2",
  } as const;
}

const looksLikeUrl = (text: string) => /^\s*https?:\/\//i.test(text);

/** A paste handler that hands a pasted URL to `onUrl` instead of typing it into the field. */
export function pasteUrlTo(onUrl: ((url: string) => void) | undefined) {
  return (event: ClipboardEvent<HTMLInputElement>) => {
    if (!onUrl) return;
    const text = event.clipboardData.getData("text");
    if (!looksLikeUrl(text)) return;
    event.preventDefault();
    onUrl(urlFromPastedText(text.trim()));
  };
}

/**
 * A row's text that is edited in place. Pressed, or reached with Tab, it becomes an input that
 * floats over its column. Enter and leaving the input save the change (`commit`); Esc puts back
 * what the field had. After Enter or Esc the focus is back on the text, which a second Enter edits
 * again. A change that cannot be saved is put back; after Enter its error shows under the text.
 *
 * Yamada UI's `Editable` keeps whether it is edited, and ends the editing on Enter, Esc and
 * leaving the input. The text is our own button, not `Editable.Preview`: the preview starts
 * editing whenever it gets the focus, so the focus could not come back to it after Enter, and it
 * shows the raw value, not 「¥3,980」. There is no `Editable.EditTrigger` either: Editable gives
 * the focus back to it however the editing ends, so Tab could not move on. Once Editable lets the
 * preview be focused without editing and show its own children (yamada-ui/yamada-ui#8069), use
 * `Editable.Preview` and drop the button and its focus handling.
 *
 * It reads its field itself, so a keystroke draws it again, not the row around it.
 */
export function InlineText({
  form,
  path,
  commit,
  label,
  preview,
  previewLabel,
  inset,
  grow,
  align = "start",
  inputMode,
  onPasteUrl,
  onTab,
  textProps,
}: {
  form: OrderForm;
  path: typeof NAME_PATH | typeof AMOUNT_PATH;
  commit: () => Promise<CommitResult>;
  /** The input's name, 「ショップ0の注文の商品名」. */
  label: string;
  /** The text shown while it is not edited. */
  preview: ReactNode;
  /** The text's name, said with what it holds. */
  previewLabel: string;
  inset: FloatInset;
  grow?: boolean;
  align?: "start" | "end";
  inputMode?: "numeric";
  onPasteUrl?: (url: string) => void;
  /** Tab (not Shift+Tab) pressed in the input, before the focus moves on. */
  onTab?: () => void;
  textProps?: ComponentProps<typeof Text>;
}) {
  /** The error of the change Enter could not save, shown under the text it put back. */
  const [rejected, setRejected] = useState<string>();
  /** What the field had when editing started, which a change that cannot be saved puts back. */
  const previous = useRef("");
  /** Set by Enter and Esc, which give the focus back to the text. */
  const byKey = useRef(false);
  /** Set while the focus goes back to the text, which then is not edited again. */
  const toText = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLButtonElement>(null);
  const rejectedId = useId();
  const field = useField(form, { path });
  const value = typeof field.input === "string" ? field.input : "";

  /** Puts a value back in the field, without its error. */
  const restore = (before: string) => {
    // Formisch takes one path at a time, not either of two.
    if (path === AMOUNT_PATH) {
      setInput(form, { path: AMOUNT_PATH, input: before });
      setErrors(form, { path: AMOUNT_PATH, errors: null });
    } else {
      setInput(form, { path: NAME_PATH, input: before });
      setErrors(form, { path: NAME_PATH, errors: null });
    }
  };

  /** Once the editing has ended, Enter and Esc leave the focus on the text. */
  const ended = () => {
    if (!byKey.current) return;
    byKey.current = false;
    requestAnimationFrame(() => {
      toText.current = true;
      textRef.current?.focus();
    });
  };

  const save = async () => {
    const enter = byKey.current;
    ended();
    const result = await commit();
    if (result !== "invalid" && result !== "failed") return;
    // Read before it is put back, which clears it.
    const error = field.errors?.[0];
    restore(previous.current);
    if (enter && result === "invalid") setRejected(error);
  };

  return (
    <Editable.Root
      value={value}
      onChange={field.onChange}
      onSubmit={() => void save()}
      onCancel={(before) => {
        ended();
        restore(before);
      }}
      // The input floats over the column, not over the text.
      display="block"
      position="static"
    >
      {({ editing, onEdit }) => {
        const start = () => {
          previous.current = value;
          byKey.current = false;
          setRejected(undefined);
          onEdit();
        };
        return (
          <>
            <Box
              as="button"
              type="button"
              ref={textRef}
              {...textBoxProps(inset)}
              textAlign={align}
              cursor="text"
              position="relative"
              // Drawn one line high, pressed 44px high over the small lines above and below it.
              _before={{
                content: '""',
                position: "absolute",
                insetBlock: "-12px",
                insetInline: "0",
              }}
              _hover={{ bg: "bg.subtle" }}
              _focusVisible={{
                outlineWidth: "2px",
                outlineStyle: "solid",
                outlineColor: "mono.outline",
              }}
              aria-label={previewLabel}
              aria-describedby={rejected ? rejectedId : undefined}
              // Kept in the row while the input covers it, so the row keeps its height.
              css={{ "&[data-editing]": { visibility: "hidden" } }}
              data-editing={dataAttr(editing)}
              onFocus={() => {
                if (toText.current) {
                  toText.current = false;
                  return;
                }
                start();
              }}
              onBlur={() => setRejected(undefined)}
              onClick={start}
            >
              <Text as="span" display="block" lineHeight="20px" truncated {...textProps}>
                {preview}
              </Text>
            </Box>
            <Editable.Input
              name={field.props.name}
              ref={mergeRefs(field.props.ref, inputRef)}
              {...floatingInputProps(inset, align)}
              data-grow={dataAttr(grow)}
              borderWidth="1px"
              borderColor="border.emphasized"
              rounded="l2"
              boxShadow="md"
              aria-label={label}
              inputMode={inputMode}
              autoComplete="off"
              onFocus={field.props.onFocus}
              onBlur={field.props.onBlur}
              onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                // An Enter or Esc that ends a conversion is the conversion's; Editable would take
                // it as the end of the editing. Remove once Editable leaves keys of a conversion
                // alone (yamada-ui/yamada-ui#8070).
                if (isComposing(event)) {
                  if (event.key === "Enter" || event.key === "Escape") event.preventDefault();
                  return;
                }
                if (event.key === "Tab" && !event.shiftKey) onTab?.();
                if (event.key === "Enter" || event.key === "Escape") byKey.current = true;
              }}
              onPaste={pasteUrlTo(onPasteUrl)}
            />
            {!editing && rejected ? (
              <FloatingError id={rejectedId}>{rejected}</FloatingError>
            ) : null}
          </>
        );
      }}
    </Editable.Root>
  );
}

/** A field's error under its floating input, over the row below. */
export function FloatingError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Text
      id={id}
      role="alert"
      position="absolute"
      top="calc(50% + 22px)"
      insetInlineStart="-9px"
      zIndex="3"
      w="max-content"
      maxW="16rem"
      px="2"
      py="1"
      rounded="l2"
      bg="bg.panel"
      boxShadow="md"
      fontSize="xs"
      color="danger.fg"
    >
      {children}
    </Text>
  );
}

/**
 * The ⌄ at a row's right end, the only thing that opens and shuts the row. It has no surface of
 * its own: pointed at, the whole row lights up (`rowToggleCss`).
 */
export function RowToggle({
  open,
  label,
  controls,
  onToggle,
  onFocus,
  onPointerDown,
  buttonRef,
}: {
  open: boolean;
  label: string;
  controls: string;
  onToggle: () => void;
  onFocus?: () => void;
  onPointerDown?: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <IconButton
      ref={buttonRef}
      data-row-toggle
      variant="ghost"
      colorScheme="gray"
      size="lg"
      disableRipple
      color="fg.muted"
      _hover={{ bg: "transparent", color: "fg" }}
      _active={{ bg: "transparent", "& > *": { transform: "translateY(1px)" } }}
      // The row draws the ring, around itself.
      _focusVisible={{ outline: "none", boxShadow: "none" }}
      aria-label={label}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      onFocus={onFocus}
      onPointerDown={onPointerDown}
    >
      <ChevronIcon open={open} />
    </IconButton>
  );
}

/** The row lights up while its ⌄ is pointed at, a step deeper while it is pressed. */
export const rowToggleCss = {
  "&:has(> [data-row-toggle]:hover)": { bg: "bg.subtle" },
  "&:has(> [data-row-toggle]:active)": { bg: "bg.muted" },
  "&:has(> [data-row-toggle]:focus-visible)": {
    outlineWidth: "2px",
    outlineStyle: "solid",
    outlineColor: "mono.outline",
    outlineOffset: "-2px",
  },
} as const;
