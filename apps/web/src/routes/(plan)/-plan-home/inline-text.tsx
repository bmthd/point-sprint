import { Box, IconButton, Input, Text } from "@workspaces/ui";
import {
  type ClipboardEvent,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { FieldState } from "#/routes/-form.tsx";
import { urlFromPastedText } from "#/routes/(plan)/-order-form-store.ts";
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

/**
 * The 40px input over the middle of its column, which spans the row's 64px: it covers the small
 * lines above and below the column's main line, and nothing in the row moves. Its text starts
 * where the column's text does.
 */
export function floatingInputProps(inset: FloatInset, align: "start" | "end") {
  return {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    insetInlineStart: inset.start,
    insetInlineEnd: inset.end,
    w: "auto",
    h: "10",
    minH: "10",
    px: "2",
    zIndex: "2",
    fontSize: "sm",
    bg: "bg.panel",
    textAlign: align,
    fontVariantNumeric: align === "end" ? "tabular-nums" : undefined,
    _focus: { borderColor: "primary.solid" },
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

/** What a row can ask of its text from outside: to be edited with the caret at the end. */
export type InlineTextHandle = { editAtEnd: () => void };

/**
 * A row's text that is edited in place. Pressed, or reached with Tab, it becomes an input that
 * floats over its column. Enter and leaving the input save the change (`commit`); Esc puts back
 * what the field had. After Enter or Esc the focus is back on the text, which a second Enter edits
 * again. A change that cannot be saved stays in the input on Enter, with its error, and is put back
 * when the input is left.
 */
export function InlineText({
  field,
  restore,
  commit,
  label,
  preview,
  previewLabel,
  inset,
  align = "start",
  inputMode,
  onPasteUrl,
  onTab,
  handleRef,
  textProps,
}: {
  field: FieldState;
  /** Puts `value` back in the field and clears its error. */
  restore: (value: string) => void;
  commit: () => Promise<CommitResult>;
  /** The input's name, 「ショップ0の注文の商品名」. */
  label: string;
  /** The text shown while it is not edited. */
  preview: ReactNode;
  /** The text's name, said with what it holds. */
  previewLabel: string;
  inset: FloatInset;
  align?: "start" | "end";
  inputMode?: "numeric";
  onPasteUrl?: (url: string) => void;
  /** Tab (not Shift+Tab) pressed in the input, before the focus moves on. */
  onTab?: () => void;
  handleRef?: Ref<InlineTextHandle>;
  textProps?: ComponentProps<typeof Text>;
}) {
  const [editing, setEditing] = useState(false);
  /** Where the caret goes once the input is in: everything selected, or after the text. */
  const caret = useRef<"select" | "end">("select");
  /** What the field had when editing started, which Esc and an unsaved change put back. */
  const previous = useRef("");
  /** Set while the focus goes back to the text, which then is not edited again. */
  const toText = useRef(false);
  /** Set once the input is done with, so its blur saves nothing more. */
  const done = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLButtonElement>(null);
  const errorId = useId();
  const value = typeof field.input === "string" ? field.input : "";

  const start = (at: "select" | "end") => {
    if (editing) return;
    caret.current = at;
    previous.current = value;
    done.current = false;
    setEditing(true);
  };

  useImperativeHandle(handleRef, () => ({ editAtEnd: () => start("end") }));

  useEffect(() => {
    if (editing) {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      if (caret.current === "select") input.select();
      else input.setSelectionRange(input.value.length, input.value.length);
      return;
    }
    if (toText.current) textRef.current?.focus();
  }, [editing]);

  const finish = (focusText: boolean) => {
    done.current = true;
    toText.current = focusText;
    setEditing(false);
  };

  const onKeyDown = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Tab" && !event.shiftKey) onTab?.();
    if (event.key === "Escape") {
      event.preventDefault();
      restore(previous.current);
      finish(true);
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    const result = await commit();
    if (result === "invalid" || result === "failed") return;
    finish(true);
  };

  const onBlur = async () => {
    field.props.onBlur();
    if (done.current) return;
    done.current = true;
    setEditing(false);
    const result = await commit();
    if (result === "invalid" || result === "failed") restore(previous.current);
  };

  const error = field.errors?.[0];

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
        _before={{ content: '""', position: "absolute", insetBlock: "-12px", insetInline: "0" }}
        _hover={{ bg: "bg.subtle" }}
        _focusVisible={{
          outlineWidth: "2px",
          outlineStyle: "solid",
          outlineColor: "primary.outline",
        }}
        aria-label={previewLabel}
        // Kept in the row while the input covers it, so the row keeps its height.
        visibility={editing ? "hidden" : undefined}
        onFocus={() => {
          if (toText.current) {
            toText.current = false;
            return;
          }
          start("select");
        }}
        onClick={() => start("select")}
      >
        <Text as="span" display="block" lineHeight="20px" truncated {...textProps}>
          {preview}
        </Text>
      </Box>
      {editing ? (
        <>
          <Input
            {...field.props}
            ref={(element: HTMLInputElement | null) => {
              field.props.ref(element);
              inputRef.current = element;
            }}
            value={value}
            {...floatingInputProps(inset, align)}
            boxShadow="md"
            aria-label={label}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            inputMode={inputMode}
            autoComplete="off"
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => void onKeyDown(event)}
            onBlur={() => void onBlur()}
            onPaste={pasteUrlTo(onPasteUrl)}
          />
          {error ? <FloatingError id={errorId}>{error}</FloatingError> : null}
        </>
      ) : null}
    </>
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
      data-row-toggle=""
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
    outlineColor: "primary.outline",
    outlineOffset: "-2px",
  },
} as const;
