// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { getInput, reset, useField, useForm, validate } from "@formisch/react";
import type { Plan } from "@workspaces/domain";
import { Box, Collapse, Flex, Input, Kbd, List, Text } from "@workspaces/ui";
import { atom, useAtom, useSetAtom } from "jotai";
import {
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  useId,
  useRef,
  useState,
} from "react";
import { shopsAtom } from "#/state/queries.ts";
import { openOrderIdAtom } from "#/routes/(plan)/-ui.ts";
import { useSingleFlight } from "#/use-single-flight.ts";
import {
  OrderFormSchema,
  type OrderFormOutput,
  draftOf,
  emptyInput,
} from "#/routes/(plan)/-order-form.ts";
import { AMOUNT_PATH, useOrderAutofill } from "#/routes/(plan)/-order-form-store.ts";
import {
  orderSaveFailedAtom,
  revealBottom,
  useSaveOrderDraft,
} from "#/routes/(plan)/-order-shared.tsx";
import { useEnterUrl } from "#/routes/(plan)/-order-entry.tsx";
import { CapFlows } from "#/routes/(plan)/-cap-flows.tsx";
import { OrderDetailFields } from "./order-details.tsx";
import {
  AMOUNT_INSET,
  FloatingError,
  NAME_INSET,
  RowToggle,
  floatingInputProps,
  pasteUrlTo,
  rowToggleCss,
} from "./inline-text.tsx";
import { type RowFocusRequest, rowColumns, rowFocusRequestAtom } from "./order-row.tsx";

/** The new order that the form's output describes, with the shops saved when it is added. */
const newDraftAtom = atom(null, (get, _set, output: OrderFormOutput) =>
  draftOf(output, get(shopsAtom), undefined),
);

/** Where the focus went as the new order was made, and so where it carries on in that order. */
type Next = RowFocusRequest["to"] | "next" | "stay";

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

/**
 * The empty row at the end of the desktop table, where a new order is typed: its name and amount
 * in the same inputs that float over an order's row, already open. It becomes an order once its
 * amount is left, or ⌘ (Ctrl) + Enter is pressed in it; then the focus carries on in that order
 * where it went, and the row is empty again under it. Its ⌄ opens the order's conditions before
 * it is made; they stay open on the order it becomes, unless ⌘ + Enter moves on to the next one.
 */
export function OrderAddRow({ plan }: { plan: Plan }) {
  const newDraft = useSetAtom(newDraftAtom);
  const saveDraft = useSaveOrderDraft(plan.id, useSetAtom(orderSaveFailedAtom));
  const run = useSingleFlight();
  const [open, setOpen] = useState(false);
  /** Bumped as an order is made, so the new row's conditions start shut, without sliding. */
  const [generation, setGeneration] = useState(0);
  // The new order's conditions and an opened row take turns: opening one closes the other.
  const [openOrderId, setOpenOrderId] = useAtom(openOrderIdAtom);
  if (open && openOrderId !== null) setOpen(false);
  const setFocusRequest = useSetAtom(rowFocusRequestAtom);
  const form = useForm({ schema: OrderFormSchema, initialInput: emptyInput(plan.period) });
  const autofill = useOrderAutofill(form);
  const enterUrl = useEnterUrl(form, autofill);
  const name = useField(form, { path: ["items", 0, "name"] });
  const amount = useField(form, { path: AMOUNT_PATH });
  const nameRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const itemRef = useRef<HTMLLIElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  /** Set while the ⌄ is pressed: a press that makes the order opens it, not the empty row. */
  const toggleDown = useRef(false);
  const skipToggleClick = useRef(false);
  /** Set by Tab in the amount: the ⌄ it moves to opens the new order's conditions. */
  const openOnToggleFocus = useRef(false);
  const nameId = useId();
  const detailId = useId();
  const nameErrorId = useId();
  const amountErrorId = useId();

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
      if (keepOpen || next === "toggle") setOpenOrderId(orderId);
      if (next === "next") nameRef.current?.focus();
      else if (next !== "stay") setFocusRequest({ orderId, to: next });
    });

  const typedAmount = () => {
    const input = getInput(form, { path: AMOUNT_PATH });
    return typeof input === "string" && input.trim() !== "";
  };

  const onAmountBlur = (event: FocusEvent<HTMLInputElement>) => {
    amount.props.onBlur();
    if (!typedAmount()) return;
    // The order it makes opens instead, if the focus goes on to the ⌄.
    openOnToggleFocus.current = false;
    const to = event.relatedTarget;
    let next: Next = "stay";
    if (to === nameRef.current) next = "name";
    else if (to === toggleRef.current || toggleDown.current) {
      next = "toggle";
      skipToggleClick.current = toggleDown.current;
    } else if (to instanceof HTMLElement && detailRef.current?.contains(to)) {
      next = { field: to.getAttribute("name") ?? "" };
    }
    void add(next);
  };

  const onAmountKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
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

  const nameError = name.errors?.[0];
  const amountError = amount.errors?.[0];
  const mod = isMac() ? "⌘" : "Ctrl";

  return (
    <List.Item ref={itemRef} borderTopWidth={plan.orders.length > 0 ? "1px" : undefined}>
      <Box
        display="grid"
        gridTemplateColumns={rowColumns}
        alignItems="center"
        gap="2.5"
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
        <Box as="label" data-press-area="" alignSelf="stretch" position="relative" minW="0">
          <Input
            {...name.props}
            ref={(element: HTMLInputElement | null) => {
              name.props.ref(element);
              nameRef.current = element;
            }}
            id={nameId}
            value={typeof name.input === "string" ? name.input : ""}
            {...floatingInputProps(NAME_INSET, "start")}
            placeholder="商品名か URL"
            aria-label="新しい注文の商品名"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? nameErrorId : undefined}
            autoComplete="off"
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
              event.preventDefault();
              document.getElementById(`${nameId}-amount`)?.focus();
            }}
            onPaste={pasteUrlTo((url) => {
              enterUrl(url);
              openConditions();
            })}
          />
          {nameError ? <FloatingError id={nameErrorId}>{nameError}</FloatingError> : null}
        </Box>
        <Box as="label" data-press-area="" alignSelf="stretch" position="relative" minW="0">
          <Input
            {...amount.props}
            id={`${nameId}-amount`}
            value={typeof amount.input === "string" ? amount.input : ""}
            {...floatingInputProps(AMOUNT_INSET, "end")}
            placeholder="金額"
            aria-label="新しい注文の金額"
            aria-required="true"
            aria-invalid={amountError ? true : undefined}
            aria-describedby={amountError ? amountErrorId : undefined}
            inputMode="numeric"
            autoComplete="off"
            onBlur={onAmountBlur}
            onKeyDown={onAmountKeyDown}
            onPaste={pasteUrlTo((url) => {
              enterUrl(url);
              openConditions();
            })}
          />
          {amountError ? <FloatingError id={amountErrorId}>{amountError}</FloatingError> : null}
        </Box>
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
              {mod}
            </Kbd>
            +
            <Kbd fontSize="2xs" h="5.5" px="1">
              Enter
            </Kbd>
          </Flex>
          <span>で追加</span>
        </Text>
        <RowToggle
          buttonRef={toggleRef}
          open={open}
          label="新しい注文の条件"
          controls={detailId}
          onToggle={() => {
            if (skipToggleClick.current) {
              skipToggleClick.current = false;
              return;
            }
            if (open) setOpen(false);
            else openConditions();
          }}
          onPointerDown={() => {
            toggleDown.current = true;
            setTimeout(() => {
              toggleDown.current = false;
            });
          }}
          onFocus={() => {
            if (!openOnToggleFocus.current) return;
            openOnToggleFocus.current = false;
            // With an amount, leaving it makes the order, whose conditions then open.
            if (!typedAmount() && !open) openConditions();
          }}
        />
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
        <Flex
          ref={detailRef}
          direction="column"
          gap="3.5"
          borderTopWidth="1px"
          pt="3.5"
          pb="4"
          px="4"
        >
          <OrderDetailFields form={form} plan={plan} autofill={autofill} simple />
          {/* A press on 「¥N で使い切る」 keeps the caret in the amount it changes, so the order is
              not made before the amount is. */}
          <Box
            onPointerDown={(event: PointerEvent) => {
              if (event.target instanceof Element && event.target.closest("button")) {
                event.preventDefault();
              }
            }}
          >
            <CapFlows plan={plan} form={form} />
          </Box>
        </Flex>
      </Collapse>
    </List.Item>
  );
}
