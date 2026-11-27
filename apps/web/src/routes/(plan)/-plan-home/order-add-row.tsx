// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import type { Plan } from "@workspaces/domain";
import { getInput, reset, setErrors, useField, useForm, validate } from "@formisch/react";
import { ClientOnly } from "@tanstack/react-router";
import {
  Box,
  Button,
  Collapse,
  Flex,
  Input,
  Kbd,
  List,
  Text,
  ariaAttr,
  isApple,
  isComposing,
  mergeRefs,
} from "@workspaces/ui";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  useId,
  useRef,
  useState,
} from "react";
import { planAtom } from "#/state/derived.ts";
import { shopsAtom } from "#/state/query-atoms.ts";
import { openOrderIdAtom } from "#/routes/(plan)/-ui.ts";
import { useSingleFlight } from "#/use-single-flight.ts";
import {
  OrderFormSchema,
  type OrderFormInput,
  type OrderFormOutput,
  draftOf,
  emptyInput,
} from "#/routes/(plan)/-order-form.ts";
import {
  AMOUNT_PATH,
  NAME_PATH,
  type OrderForm,
  useOrderAutofill,
} from "#/routes/(plan)/-order-form-store.ts";
import {
  orderSaveFailedAtom,
  revealBottom,
  useSaveOrderDraft,
} from "#/routes/(plan)/-order-shared.tsx";
import { useEnterUrl } from "#/routes/(plan)/-order-entry.tsx";
import { DraftPreview } from "#/routes/(plan)/-order-editor/order-editor.tsx";
import { CapFlows } from "#/routes/(plan)/-cap-flows.tsx";
import { ACTION_BUTTON_WIDTH, OrderDetailFields } from "./order-details.tsx";
import {
  AMOUNT_INSET,
  NAME_INSET,
  ROW_GAP,
  RowToggle,
  floatingInputProps,
  pasteUrlTo,
  rowToggleCss,
} from "./inline-text.tsx";
import { rowColumns } from "./order-row.tsx";

/** The new order that the form's output describes, with the shops saved when it is added. */
const newDraftAtom = atom(null, (get, _set, output: OrderFormOutput) =>
  draftOf(output, get(shopsAtom), undefined),
);

/** Where the focus went as the new order was made, and so where it carries on in that order. */
type Next = "next" | "stay";

/**
 * The empty row at the end of the desktop table, where a new order is typed: its name and amount
 * in the same inputs that float over an order's row, already open. It becomes an order once its
 * amount is left, or ⌘ (Ctrl) + Enter is pressed in it; then the focus carries on in that order
 * where it went, and the row is empty again under it. Its ⌄ opens the order's conditions before
 * it is made; they stay open on the order it becomes, unless ⌘ + Enter moves on to the next one.
 */
export function OrderAddRow(props: {
  planId: string;
  initialInput?: OrderFormInput;
  initialOpen?: boolean;
}) {
  const plan = useAtomValue(planAtom(props.planId));
  return plan ? <AddRow {...props} plan={plan} /> : null;
}

function AddRow({
  plan,
  initialInput,
  initialOpen = false,
}: {
  plan: Plan;
  /** What the row starts with, empty by default: the help's figure shows an order being typed. */
  initialInput?: OrderFormInput;
  /** Whether the conditions start open. */
  initialOpen?: boolean;
}) {
  const newDraft = useSetAtom(newDraftAtom);
  const saveDraft = useSaveOrderDraft(plan.id, useSetAtom(orderSaveFailedAtom));
  const run = useSingleFlight();
  const [open, setOpen] = useState(initialOpen);
  /** Bumped as an order is made, so the new row's conditions start shut, without sliding. */
  const [generation, setGeneration] = useState(0);
  // The new order's conditions and an opened row take turns: opening one closes the other.
  const [openOrderId, setOpenOrderId] = useAtom(openOrderIdAtom);
  if (open && openOrderId !== null) setOpen(false);
  const form = useForm({
    schema: OrderFormSchema,
    initialInput: initialInput ?? emptyInput(plan.period),
  });
  const autofill = useOrderAutofill(form);
  const enterUrl = useEnterUrl(form, autofill);
  const nameRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const itemRef = useRef<HTMLLIElement>(null);
  /** Set by Tab in the amount: the ⌄ it moves to opens the row's conditions. */
  const openOnToggleFocus = useRef(false);
  const nameId = useId();
  const detailId = useId();
  const errorId = useId();

  const openConditions = () => {
    setOpenOrderId(null);
    setOpen(true);
  };

  /** Makes the typed order, if it is valid, and carries the focus on to `next`. */
  const add = (next: Next) =>
    run(async () => {
      const result = await validate(form);
      if (!result.success) return;
      const draft = newDraft(result.output);
      // Not saved, the typed order stays in the row so it can be made again.
      if (!draft || !(await saveDraft(draft, true))) return;
      const orderId = draft.order.id;
      const keepOpen = open && next !== "next";
      reset(form, { initialInput: emptyInput(plan.period) });
      // Leaving the URL field would look up the URL it still showed.
      autofill.reset();
      setOpen(false);
      setGeneration((count) => count + 1);
      if (keepOpen) setOpenOrderId(orderId);
      if (next === "next") nameRef.current?.focus();
    });

  const typedAmount = () => {
    const input = getInput(form, { path: AMOUNT_PATH });
    return typeof input === "string" && input.trim() !== "";
  };

  /**
   * Leaving the row makes the order. Moving within it (the amount to the name, the ⌄, the
   * conditions) does not: an order made while its name is still being typed was unexpected.
   */
  const onRowBlur = (event: FocusEvent<HTMLElement>) => {
    const to = event.relatedTarget;
    if (to instanceof Node && itemRef.current?.contains(to)) return;
    if (!typedAmount()) return;
    void add("stay");
  };

  const onAmountKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (isComposing(event)) return;
    if (event.key === "Tab" && !event.shiftKey) {
      openOnToggleFocus.current = true;
      setTimeout(() => {
        openOnToggleFocus.current = false;
      });
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (event.metaKey || event.ctrlKey) void add("next");
  };

  const onPasteUrl = (url: string) => {
    enterUrl(url);
    openConditions();
  };

  return (
    <List.Item ref={itemRef} onBlur={onRowBlur}>
      <Box
        display="grid"
        gridTemplateColumns={rowColumns}
        alignItems="center"
        gap={ROW_GAP}
        px="3"
        minH="16"
        css={rowToggleCss}
      >
        {/* Where an order has its handle, switch and number: what puts the caret in the name. */}
        <Text
          as="label"
          htmlFor={nameId}
          gridColumn="1 / 4"
          ps="1"
          color="primary.fg"
          fontWeight="semibold"
          whiteSpace="nowrap"
          cursor="pointer"
        >
          ＋ 注文を追加
        </Text>
        {/* The whole column puts the caret in its input, which is drawn 40px high. */}
        <Box as="label" data-press-area alignSelf="stretch" position="relative" minW="0">
          <NameInput
            form={form}
            id={nameId}
            errorId={errorId}
            inputRef={nameRef}
            onPasteUrl={onPasteUrl}
          />
        </Box>
        <Box as="label" data-press-area alignSelf="stretch" position="relative" minW="0">
          <AmountInput
            form={form}
            id={`${nameId}-amount`}
            errorId={errorId}
            onKeyDown={onAmountKeyDown}
            onPasteUrl={onPasteUrl}
          />
        </Box>
        <ErrorOrHint form={form} id={errorId} />
        <RowToggle
          buttonRef={toggleRef}
          open={open}
          label="新しい注文の条件"
          controls={detailId}
          onToggle={() => {
            if (open) setOpen(false);
            else openConditions();
          }}
          onFocus={() => {
            if (!openOnToggleFocus.current) return;
            openOnToggleFocus.current = false;
            if (!open) openConditions();
          }}
        />
      </Box>
      <Box px="4" pb="3">
        <DraftPreview form={form} planId={plan.id} />
      </Box>
      {/* Shut, the fields are taken out; what was typed stays in the form. */}
      <Collapse
        key={generation}
        open={open}
        unmountOnExit
        // Clipped, not scrolled: a field focused while it slides open (Tab from the amount opens
        // it) would otherwise scroll the fields up inside it, and leave them there.
        style={{ overflow: "clip" }}
        id={detailId}
        onAnimationComplete={() => {
          if (open && itemRef.current) revealBottom(itemRef.current);
        }}
      >
        <Flex direction="column" gap="3.5" borderTopWidth="1px" pt="3.5" pb="4" px="4">
          <OrderDetailFields form={form} plan={plan} autofill={autofill} />
          {/* A press on 「¥N で使い切る」 keeps the caret in the amount it changes. */}
          <Box
            onPointerDown={(event: PointerEvent) => {
              if (event.target instanceof Element && event.target.closest("button")) {
                event.preventDefault();
              }
            }}
          >
            <CapFlows plan={plan} form={form} />
          </Box>
          {/* Where an opened order has 「複製」 and 「削除」. */}
          <Flex justify="flex-end">
            <Button
              colorScheme="primary"
              size="lg"
              minW={ACTION_BUTTON_WIDTH}
              onClick={() => void add("next")}
            >
              追加する
            </Button>
          </Flex>
        </Flex>
      </Collapse>
    </List.Item>
  );
}

type RowInputProps = {
  form: OrderForm;
  id: string;
  /** The id of the error said where ⌘ + Enter is. */
  errorId: string;
  onPasteUrl: (url: string) => void;
};

// The name, the amount and the line beside them each read their own fields, so a keystroke draws
// the input again, not the row and its opened conditions.

/** The new order's name. Enter moves on to the amount. */
function NameInput({
  form,
  id,
  errorId,
  inputRef,
  onPasteUrl,
}: RowInputProps & { inputRef: RefObject<HTMLInputElement | null> }) {
  const name = useField(form, { path: NAME_PATH });
  return (
    <Input
      {...name.props}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        name.props.onChange(event);
        if (name.errors) setErrors(form, { path: NAME_PATH, errors: null });
      }}
      ref={mergeRefs(name.props.ref, inputRef)}
      id={id}
      value={typeof name.input === "string" ? name.input : ""}
      {...floatingInputProps(NAME_INSET, "start")}
      data-grow
      placeholder="商品名またはURL"
      aria-label="新しい注文の商品名"
      aria-invalid={ariaAttr(name.errors)}
      aria-describedby={name.errors ? errorId : undefined}
      autoComplete="off"
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== "Enter" || isComposing(event)) return;
        event.preventDefault();
        document.getElementById(`${id}-amount`)?.focus();
      }}
      onPaste={pasteUrlTo(onPasteUrl)}
    />
  );
}

/** The new order's amount, which it cannot be made without. */
function AmountInput({
  form,
  id,
  errorId,
  onKeyDown,
  onPasteUrl,
}: RowInputProps & { onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void }) {
  const amount = useField(form, { path: AMOUNT_PATH });
  return (
    <Input
      {...amount.props}
      // Typed again, the error gives way to the ⌘ + Enter hint: the form is never submitted,
      // so Formisch would not check the field again as it is typed.
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        amount.props.onChange(event);
        if (amount.errors) setErrors(form, { path: AMOUNT_PATH, errors: null });
      }}
      id={id}
      value={typeof amount.input === "string" ? amount.input : ""}
      {...floatingInputProps(AMOUNT_INSET, "end")}
      placeholder="金額"
      aria-label="新しい注文の金額"
      aria-required="true"
      aria-invalid={ariaAttr(amount.errors)}
      aria-describedby={amount.errors ? errorId : undefined}
      inputMode="numeric"
      autoComplete="off"
      onKeyDown={onKeyDown}
      onPaste={pasteUrlTo(onPasteUrl)}
    />
  );
}

/**
 * A value the order cannot be made with, said where ⌘ + Enter is, in place of it: under the
 * inputs the table would cut it off. It reads only the two fields' errors.
 */
function ErrorOrHint({ form, id }: { form: OrderForm; id: string }) {
  const nameError = useField(form, { path: NAME_PATH }).errors?.[0];
  const amountError = useField(form, { path: AMOUNT_PATH }).errors?.[0];
  return nameError || amountError ? (
    <Text
      id={id}
      role="alert"
      justifySelf="end"
      fontSize="2xs"
      fontWeight="semibold"
      color="danger.fg"
      textAlign="end"
      lineHeight="short"
      lineClamp={3}
    >
      {amountError ?? nameError}
    </Text>
  ) : (
    <Text
      as="span"
      justifySelf="end"
      fontSize="2xs"
      color="fg.muted"
      whiteSpace="nowrap"
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap="0.5"
      lineHeight="short"
    >
      {/* The 「+」 sits on the keys' middle, not on their baseline. ⌘ is a square key. */}
      <Flex as="span" align="center" gap="1">
        <Kbd fontSize="2xs" h="5.5" minW="5.5" px="1" justifyContent="center">
          {/* Ahead of time, as the help's figure draws the row, ⌘ until the browser says which. */}
          <ClientOnly fallback="⌘">{isApple() ? "⌘" : "Ctrl"}</ClientOnly>
        </Kbd>
        +
        <Kbd fontSize="2xs" h="5.5" px="1">
          Enter
        </Kbd>
      </Flex>
      <span>で追加</span>
    </Text>
  );
}
