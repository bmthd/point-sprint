// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { focus, getInput, reset, useField, useForm, validate } from "@formisch/react";
import { type Order, type Shop, taxExcludedTarget, taxIncludedTarget } from "@workspaces/domain";
import {
  Box,
  Collapse,
  Flex,
  Button,
  IconButton,
  List,
  Switch,
  Text,
  VisuallyHidden,
  isComposing,
  runKeyAction,
  useCallbackRef,
} from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import {
  type KeyboardEvent,
  type RefObject,
  createContext,
  memo,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { grouped, pointsText, rateText, yen } from "#/ui/format.ts";
import { orderAtom, planAtom } from "#/state/derived.ts";
import { copyOrderAtom, moveOrderAtom, toggleHoldAtom } from "#/state/plan-operations.ts";
import { shopsAtom } from "#/state/queries.ts";
import { openOrderIdAtom } from "#/routes/(plan)/-ui.ts";
import { monthDayWithWeekday } from "#/ui/dates.ts";
import { GripIcon } from "#/ui/icons.tsx";
import {
  OrderFormSchema,
  type OrderFormInput,
  draftOf,
  hasDetails,
  inputOf,
} from "#/routes/(plan)/-order-form.ts";
import {
  AMOUNT_PATH,
  NAME_PATH,
  type OrderForm,
  useOrderAutofill,
} from "#/routes/(plan)/-order-form-store.ts";
import { NEW_SHOP } from "#/routes/(plan)/-order-fields.tsx";
import { useEnterUrl } from "#/routes/(plan)/-order-entry.tsx";
import {
  CampaignChip,
  OrderBadge,
  groupTotalsOf,
  isOpenAtom,
  orderCardPointsAtom,
  orderTitle,
  taxLabel,
  orderSaveFailedAtom,
  revealBottom,
  useSaveOrderChange,
  useSaveOrderDraft,
  useShopName,
} from "#/routes/(plan)/-order-shared.tsx";
import { PointBreakdown } from "#/routes/-point-breakdown.tsx";
import { ACTION_BUTTON_WIDTH, OrderDetailFields } from "./order-details.tsx";
import {
  AMOUNT_COLUMN,
  AMOUNT_INSET,
  type CommitResult,
  InlineText,
  NAME_INSET,
  POINTS_COLUMN,
  ROW_GAP,
  RowToggle,
  rowToggleCss,
  textBoxProps,
} from "./inline-text.tsx";
import type { DragStart } from "./use-order-drag.ts";

/** What the list shares with its rows without re-rendering them: refs and stable callbacks. */
export type OrderListContext = {
  /** Starts dragging a row by its handle. */
  startDrag: DragStart;
  /** The order whose handle gets the focus back once it has moved. */
  focusAfterMoveRef: RefObject<string | null>;
  /** Says where an order moved, through the list's live region. */
  announce: (message: string) => void;
  /** The id of the text that explains the arrow keys on a handle. */
  handleHintId: string;
  /** The id of the text that explains what turning 購入決定 off does. */
  holdHintId: string;
};

export const OrderListContext = createContext<OrderListContext | null>(null);

const useListContext = () => {
  const context = useContext(OrderListContext);
  if (!context) throw new Error("OrderRow must be rendered inside an OrderTable");
  return context;
};

/**
 * The columns of a row: handle, switch, number, item, amount, points, ⌄. Only the item's column
 * grows and shrinks. The amount and the points are as wide in every row, the add row too, so
 * their edges and the inputs that float over them line up down the table. The points are wide
 * enough to leave a gap between the amount's input and the add row's ⌘ + Enter hint.
 */
export const rowColumns = `24px 56px 36px minmax(0, 1fr) ${AMOUNT_COLUMN} ${POINTS_COLUMN} 44px`;

/**
 * Whether the row edits the order's name and amount itself: one item, bought once, without a
 * coupon. Any other order is edited in its opened row. A stopgap until #344 gives each item a line.
 */
export function isSimpleOrder(order: Order) {
  return !hasDetails(order);
}

/** The form's input as text, its keys sorted: the form and `inputOf` list them in different orders. */
const inputKey = (input: unknown): string =>
  JSON.stringify(input, (_key, value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)))
      : value,
  );

/** The fields of a saved order, the amount with its thousands separated as it is typed. */
function editInputOf(order: Order, shops: Shop[]): OrderFormInput {
  const input = inputOf(order, shops);
  return {
    ...input,
    items: input.items.map((item) => ({
      ...item,
      unitPrice: grouped(Number(item.unitPrice)),
    })),
  };
}

/**
 * The order's form, shared by the row's name and amount and its opened fields. A change is saved
 * once it is valid (`commit`): a choice at once, typed text when its field is left or Enter is
 * pressed. A change saved elsewhere comes into the fields.
 */
function useOrderEditForm(planId: string, order: Order) {
  const shops = useAtomValue(shopsAtom);
  const saveDraft = useSaveOrderDraft(planId, useSetAtom(orderSaveFailedAtom));
  const form = useForm({ schema: OrderFormSchema, initialInput: editInputOf(order, shops) });
  /** The input last saved, or being saved: the same input is not saved twice. */
  const saved = useRef("");
  // Read once, out of the render: reading every field while the row draws would draw the row
  // again on every change of any of them.
  useLayoutEffect(() => {
    saved.current = inputKey(getInput(form));
  }, [form]);

  const commit = async (): Promise<CommitResult> => {
    const input = getInput(form);
    const json = inputKey(input);
    if (json === saved.current) return "unchanged";
    // A new shop is saved once it has a name.
    if (input.shop === NEW_SHOP && !input.newShopName?.trim() && !input.shopCode) return "pending";
    const previous = saved.current;
    saved.current = json;
    const result = await validate(form);
    const draft = result.success ? draftOf(result.output, shops, order) : undefined;
    if (!draft) {
      saved.current = previous;
      return "invalid";
    }
    if (await saveDraft(draft, false)) return "saved";
    // Not saved: the same input can be saved again.
    saved.current = previous;
    return "failed";
  };
  const latestCommit = useCallbackRef(commit);
  const autofill = useOrderAutofill(form, () => void latestCommit());

  useEffect(() => {
    const next = editInputOf(order, shops);
    const json = inputKey(next);
    if (json === saved.current) return;
    saved.current = json;
    reset(form, { initialInput: next });
  }, [order, shops, form]);

  return { form, commit, latestCommit, autofill };
}

/**
 * Saves a choice as soon as it is made; typed text is saved when its field is left or Enter is
 * pressed. It draws nothing: the fields it watches draw it again, not the row.
 */
function InstantCommit({ form, commit }: { form: OrderForm; commit: () => Promise<CommitResult> }) {
  const instantKey = JSON.stringify([
    useField(form, { path: ["shop"] }).input,
    useField(form, { path: ["channel"] }).input,
    useField(form, { path: ["date"] }).input,
    useField(form, { path: ["items", 0, "taxRate"] }).input,
    useField(form, { path: ["items", 0, "shopPointRate"] }).input,
    useField(form, { path: ["is39"] }).input,
    useField(form, { path: ["repeat"] }).input,
    useField(form, { path: ["brandDay"] }).input,
    useField(form, { path: ["is24h"] }).input,
  ]);
  useEffect(() => {
    // A new shop's name is typed in the shop field: it is saved when the field is left.
    if (getInput(form).shop === NEW_SHOP) return;
    void commit();
  }, [instantKey, commit, form]);
  return null;
}

/**
 * The opened row's fields. Typed text is saved when its field is left or Enter is pressed, a
 * choice as soon as it is made.
 */
function OrderEditor({
  planId,
  order,
  form,
  autofill,
  commit,
}: {
  planId: string;
  order: Order;
  form: OrderForm;
  autofill: ReturnType<typeof useOrderAutofill>;
  commit: () => Promise<CommitResult>;
}) {
  const plan = useAtomValue(planAtom(planId));
  if (!plan) return null;
  return (
    <Box
      onBlur={(event) => {
        // Text is saved when its field is left, not when the focus moves within it.
        if (event.target instanceof HTMLInputElement) void commit();
      }}
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        if (event.key !== "Enter" || isComposing(event)) return;
        if (!(event.target instanceof HTMLInputElement)) return;
        void commit();
      }}
      // An added item's tax rate is a choice, saved as soon as it is made.
      onChange={(event) => {
        if (event.target instanceof HTMLSelectElement) void commit();
      }}
    >
      <OrderDetailFields
        form={form}
        plan={plan}
        autofill={autofill}
        simple={isSimpleOrder(order)}
        onItemRemoved={() => void commit()}
      />
    </Box>
  );
}

export type OrderRowProps = {
  planId: string;
  orderId: string;
  /** Position among the counted orders, or `null` for a held order. */
  badge: number | null;
  index: number;
  /** How many orders the list has. */
  count: number;
  onDelete: (orderId: string) => void;
};

/**
 * One order in the desktop list. Its name and amount are edited on the row; its ⌄ opens it
 * downwards into its conditions, breakdown, 「複製」 and 「削除」. The handle moves the order by
 * dragging, or with the arrow keys while it has the focus.
 */
export const OrderRow = memo(function OrderRow(props: OrderRowProps) {
  const { planId, orderId } = props;
  const key = useMemo(() => ({ planId, orderId }), [planId, orderId]);
  const order = useAtomValue(orderAtom(key));
  return order ? <LoadedRow {...props} order={order} /> : null;
});

function LoadedRow(props: OrderRowProps & { order: Order }) {
  const { planId, orderId, index, count, order } = props;
  const key = useMemo(() => ({ planId, orderId }), [planId, orderId]);
  const points = useAtomValue(orderCardPointsAtom(key));
  const open = useAtomValue(isOpenAtom(orderId));
  const setOpenOrderId = useSetAtom(openOrderIdAtom);
  const toggleHold = useSetAtom(toggleHoldAtom);
  const copyOrder = useSetAtom(copyOrderAtom);
  const moveOrder = useSetAtom(moveOrderAtom);
  const save = useSaveOrderChange();
  const shopName = useShopName(order);
  const { startDrag, focusAfterMoveRef, announce, handleHintId, holdHintId } = useListContext();
  const detailId = useId();
  const handleRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const itemRef = useRef<HTMLLIElement>(null);
  /** Set by Tab in the amount: the ⌄ it moves to opens the row. */
  const openOnToggleFocus = useRef(false);
  const { form, commit, latestCommit, autofill } = useOrderEditForm(planId, order);
  const enterUrl = useEnterUrl(form, autofill);

  // Moving an order can take its row out of the document for a moment, which drops the focus.
  useEffect(() => {
    if (focusAfterMoveRef.current !== orderId) return;
    focusAfterMoveRef.current = null;
    handleRef.current?.focus();
  }, [index, orderId, focusAfterMoveRef]);

  const held = order.onHold;
  const simple = isSimpleOrder(order);

  const moveTo = (toIndex: number) => {
    focusAfterMoveRef.current = orderId;
    const moved = moveOrder({ planId, orderId, toIndex });
    save(moved);
    announce(`${shopName}の注文を${toIndex + 1}番目に移動しました`);
    return moved;
  };

  const moveBy = (step: number) => {
    setOpenOrderId(null);
    const toIndex = index + step;
    if (toIndex >= 0 && toIndex < count) void moveTo(toIndex);
  };
  const onHandleKeyDown = (event: KeyboardEvent<HTMLElement>) =>
    runKeyAction(event, { ArrowUp: () => moveBy(-1), ArrowDown: () => moveBy(1) });

  /** Tab from the amount: the row opens as the ⌄ gets the focus. */
  const openOnTab = () => {
    openOnToggleFocus.current = true;
    setTimeout(() => {
      openOnToggleFocus.current = false;
    });
  };

  /** A URL pasted into the name or the amount is looked up, with the row open to show it. */
  const pasteUrl = (url: string) => {
    enterUrl(url);
    setOpenOrderId(orderId);
  };

  const base = order.lineItems.reduce((sum, item) => sum + taxExcludedTarget(item), 0);
  const amount = order.lineItems.reduce((sum, item) => sum + taxIncludedTarget(item), 0);
  const title =
    orderTitle(order) ||
    (shopName === "ショップ未入力" ? `${monthDayWithWeekday(order.date)}の注文` : "");

  return (
    <List.Item
      ref={itemRef}
      data-order-id={orderId}
      borderTopWidth={index === 0 ? undefined : "1px"}
    >
      <InstantCommit form={form} commit={latestCommit} />
      <Box
        // Painted, so a dragged row covers the rows it passes.
        bg="bg.panel"
        display="grid"
        gridTemplateColumns={rowColumns}
        alignItems="center"
        gap={ROW_GAP}
        px="3"
        minH="16"
        css={rowToggleCss}
      >
        {/* Drawn as tall as its dots, but pressed in a 44px square that reaches past its column. */}
        <IconButton
          ref={handleRef}
          variant="ghost"
          size="lg"
          colorScheme="gray"
          w="6"
          minW="6"
          h="9"
          minH="9"
          px="0"
          justifySelf="center"
          position="relative"
          overflow="visible"
          zIndex="1"
          // From inside its 1px border: 10px and 4px past the 24px by 36px button make 44px.
          _before={{
            content: '""',
            position: "absolute",
            insetBlock: "-5px",
            insetInline: "-11px",
          }}
          cursor="grab"
          // A drag on the handle moves the row, not the page.
          touchAction="none"
          aria-label={`${shopName}の注文を並べ替え`}
          aria-describedby={handleHintId}
          onKeyDown={onHandleKeyDown}
          onPointerDown={(event) =>
            startDrag(event, {
              from: index,
              onStart: () => setOpenOrderId(null),
              onDrop: moveTo,
            })
          }
        >
          <GripIcon />
        </IconButton>
        <Switch
          size="sm"
          colorScheme="primary"
          boxSize="11"
          justifySelf="center"
          justifyContent="center"
          checked={!held}
          inputProps={{
            "aria-label": `${shopName}の注文を購入決定`,
            "aria-describedby": holdHintId,
          }}
          onChange={() => save(toggleHold({ planId, orderId }))}
        />
        <OrderBadge badge={props.badge} />
        {/* Each column in the same lanes: a small line, the main line, the campaigns' line. */}
        <Flex
          minW="0"
          alignSelf="stretch"
          direction="column"
          justify="center"
          gap="0.5"
          position="relative"
        >
          <Flex as="span" gap="2" h="4" lineHeight="16px" fontSize="xs" color="fg.muted">
            <Text as="span" lineClamp={1} wordBreak="break-all">
              {shopName}
            </Text>
            <Text as="span" flex="none" fontVariantNumeric="tabular-nums">
              {monthDayWithWeekday(order.date)}
            </Text>
          </Flex>
          <InlineText
            form={form}
            path={NAME_PATH}
            commit={commit}
            label={`${shopName}の注文の商品名`}
            previewLabel={`${shopName}の注文の商品名 ${title}`}
            preview={title || "商品名"}
            textProps={{
              fontSize: "sm",
              fontWeight: title ? "medium" : "normal",
              color: title ? undefined : "fg.muted",
            }}
            inset={NAME_INSET}
            grow
            onPasteUrl={pasteUrl}
          />
          {/* Kept, one chip high, on rows without campaigns so every closed row is as tall. */}
          <Flex as="span" wrap="wrap" gap="1" minH="5.5">
            {points.campaigns.map((label) => (
              <CampaignChip key={label}>{label}</CampaignChip>
            ))}
          </Flex>
        </Flex>
        <Flex
          alignSelf="stretch"
          direction="column"
          justify="center"
          align="flex-end"
          gap="0.5"
          position="relative"
          minW="0"
          fontSize="sm"
          fontVariantNumeric="tabular-nums"
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key === "Tab" && !event.shiftKey && !simple) openOnTab();
          }}
        >
          <Text as="span" h="4" lineHeight="16px" fontSize="2xs" color="fg.muted">
            税込 {taxLabel(order.lineItems)}
          </Text>
          {simple ? (
            <InlineText
              form={form}
              path={AMOUNT_PATH}
              commit={commit}
              label={`${shopName}の注文の金額`}
              previewLabel={`${shopName}の注文の金額 ${yen(amount)}`}
              preview={yen(amount)}
              inset={AMOUNT_INSET}
              align="end"
              inputMode="numeric"
              onPasteUrl={pasteUrl}
              onTab={openOnTab}
            />
          ) : (
            // Not a plain item: its amount is edited in the opened row, which a press opens.
            <Box
              as="button"
              type="button"
              {...textBoxProps(AMOUNT_INSET)}
              textAlign="end"
              lineHeight="20px"
              position="relative"
              _before={{
                content: '""',
                position: "absolute",
                insetBlock: "-12px",
                insetInline: "0",
              }}
              _hover={{ bg: "bg.subtle" }}
              aria-label={`${shopName}の注文の金額 ${yen(amount)}（開いて商品ごとに直す）`}
              onClick={() => {
                setOpenOrderId(orderId);
                requestAnimationFrame(() => focus(form, { path: AMOUNT_PATH }));
              }}
            >
              {yen(amount)}
            </Box>
          )}
          <Box h="5.5" />
        </Flex>
        <Flex
          alignSelf="stretch"
          direction="column"
          justify="center"
          align="flex-end"
          gap="0.5"
          fontVariantNumeric="tabular-nums"
        >
          {/* Both labels share one cell, so the column is as wide whichever one shows. */}
          <Box
            display="grid"
            justifyItems="end"
            h="4"
            lineHeight="16px"
            fontSize="2xs"
            color="fg.muted"
          >
            <Text as="span" gridArea="1 / 1" visibility={held ? "hidden" : undefined}>
              {rateText(points.rate, false)}
            </Text>
            <Text as="span" gridArea="1 / 1" visibility={held ? undefined : "hidden"} aria-hidden>
              保留中
            </Text>
          </Box>
          {/* Held or not, the same lines, so turning 購入決定 off leaves the row where it is. */}
          {held ? (
            <Text as="s" h="22px" lineHeight="22px" fontWeight="bold" color="fg.muted">
              <VisuallyHidden>保留中の見込み </VisuallyHidden>
              {pointsText(points.total)}
            </Text>
          ) : (
            <Text as="span" h="22px" lineHeight="22px" fontWeight="bold">
              {pointsText(points.total)}
            </Text>
          )}
          <Box h="5.5" />
        </Flex>
        <RowToggle
          buttonRef={toggleRef}
          open={open}
          label={`${shopName}の注文の詳細と編集`}
          controls={detailId}
          onToggle={() => setOpenOrderId(open ? null : orderId)}
          onFocus={() => {
            if (!openOnToggleFocus.current) return;
            openOnToggleFocus.current = false;
            if (!open) setOpenOrderId(orderId);
          }}
        />
      </Box>
      {/* It slides open and shut, so a press shows which order the fields below belong to. */}
      {/* Once open, the window scrolls only if 「複製」 and 「削除」 are off it, as little as it can. */}
      <Collapse
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
          <Flex direction="column" gap="2">
            <PointBreakdown totals={groupTotalsOf(points.rows)} legend="line" held={held} />
            <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums">
              {`税抜の基準額 ${yen(base)}`}
            </Text>
          </Flex>
          <OrderEditor
            planId={planId}
            order={order}
            form={form}
            autofill={autofill}
            commit={commit}
          />
          <Flex wrap="wrap" gap="2" justify="flex-end">
            <Button
              variant="outline"
              size="lg"
              minW={ACTION_BUTTON_WIDTH}
              onClick={() => save(copyOrder({ planId, orderId }))}
            >
              複製
            </Button>
            <Button
              variant="outline"
              size="lg"
              colorScheme="danger"
              minW={ACTION_BUTTON_WIDTH}
              onClick={() => props.onDelete(orderId)}
            >
              削除
            </Button>
          </Flex>
        </Flex>
      </Collapse>
    </List.Item>
  );
}
