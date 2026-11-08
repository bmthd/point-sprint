// Formisch fields read their signals through getters on objects that keep their identity, so
// React Compiler would memoize what they return and miss every change.
"use no memo";

import { getInput, reset, useField, useForm, validate } from "@formisch/react";
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
  useMemo,
  useRef,
} from "react";
import { grouped, pointsText, rateText, yen } from "#/ui/format.ts";
import { orderAtom, planAtom } from "#/state/derived.ts";
import { copyOrderAtom, moveOrderAtom, toggleHoldAtom } from "#/state/plan-operations.ts";
import { shopsAtom } from "#/state/queries.ts";
import { openOrderIdAtom } from "#/routes/(plan)/-ui.ts";
import { useLatestRef } from "#/use-latest-ref.ts";
import { monthDayWithWeekday } from "#/ui/dates.ts";
import { ChevronIcon, GripIcon } from "#/ui/icons.tsx";
import {
  OrderFormSchema,
  type OrderFormInput,
  draftOf,
  inputOf,
} from "#/routes/(plan)/-order-form.ts";
import { useOrderAutofill } from "#/routes/(plan)/-order-form-store.ts";
import { NEW_SHOP } from "#/routes/(plan)/-order-fields.tsx";
import {
  CampaignChip,
  OrderBadge,
  groupTotalsOf,
  isOpenAtom,
  orderCardPointsAtom,
  orderTitle,
  taxLabel,
  orderSaveFailedAtom,
  useSaveOrderChange,
  useSaveOrderDraft,
  useShopName,
} from "#/routes/(plan)/-order-shared.tsx";
import { ACTION_BUTTON_WIDTH, OrderFormFields } from "./order-form-fields";
import { PointBreakdown } from "#/routes/-point-breakdown.tsx";
import type { DragStart } from "./use-order-drag";

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

/** The columns of a closed row. Only the middle one (shop, item, campaigns) grows and shrinks. */
export const rowColumns = "24px 56px 36px minmax(0, 1fr) auto auto 44px";

/**
 * Whether the order uses 「詳細設定」: more than one item, or an item bought more than once or with
 * a coupon. Its row opens with them shown.
 */
const hasDetails = (order: Order) =>
  order.lineItems.length > 1 ||
  order.lineItems.some((item) => item.quantity !== 1 || item.discount);

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
 * The order's fields, edited in place with the add form's fields. A change is saved once it is
 * valid: a choice at once, typed text when its field is left or Enter is pressed.
 */
function InlineOrderEditor({ planId, order }: { planId: string; order: Order }) {
  const plan = useAtomValue(planAtom(planId));
  const shops = useAtomValue(shopsAtom);
  const saveDraft = useSaveOrderDraft(planId, useSetAtom(orderSaveFailedAtom));
  const form = useForm({ schema: OrderFormSchema, initialInput: editInputOf(order, shops) });
  /** The input last saved, or being saved: the same input is not saved twice. */
  const saved = useRef(inputKey(getInput(form)));

  const commit = async () => {
    const input = getInput(form);
    const json = inputKey(input);
    if (json === saved.current) return;
    // A new shop is saved once it has a name.
    if (input.shop === NEW_SHOP && !input.newShopName?.trim() && !input.shopCode) return;
    const previous = saved.current;
    saved.current = json;
    const result = await validate(form);
    const draft = result.success ? draftOf(result.output, shops, order) : undefined;
    if (!draft) {
      saved.current = previous;
      return;
    }
    // Not saved: the same input can be saved again.
    if (!(await saveDraft(draft, false))) saved.current = previous;
  };
  const commitRef = useLatestRef(commit);
  const autofill = useOrderAutofill(form, () => void commitRef.current());

  // A choice is saved as soon as it is made; typed text when its field is left or Enter is pressed.
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
    void commitRef.current();
  }, [instantKey, commitRef, form]);

  // A change saved elsewhere (to the shop, or in another tab) comes into the fields.
  useEffect(() => {
    const next = editInputOf(order, shops);
    const json = inputKey(next);
    if (json === saved.current) return;
    saved.current = json;
    reset(form, { initialInput: next });
  }, [order, shops, form]);

  if (!plan) return null;

  return (
    <Flex
      direction="column"
      gap="3"
      onBlur={(event) => {
        // Text is saved when its field is left, not when the focus moves within it.
        if (event.target instanceof HTMLInputElement) void commit();
      }}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
        if (!(event.target instanceof HTMLInputElement)) return;
        void commit();
      }}
      // An added item's tax rate is a choice, saved as soon as it is made.
      onChange={(event) => {
        if (event.target instanceof HTMLSelectElement) void commit();
      }}
    >
      <OrderFormFields
        form={form}
        plan={plan}
        autofill={autofill}
        detailsOpen={hasDetails(order)}
        onItemRemoved={() => void commit()}
      />
    </Flex>
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
 * One order in the desktop list, which opens downwards into its breakdown and edit fields. The
 * handle moves the order by dragging, or with the arrow keys while it has the focus.
 */
export const OrderRow = memo(function OrderRow(props: OrderRowProps) {
  const { planId, orderId, index, count } = props;
  const key = useMemo(() => ({ planId, orderId }), [planId, orderId]);
  const order = useAtomValue(orderAtom(key));
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

  // Moving an order can take its row out of the document for a moment, which drops the focus.
  useEffect(() => {
    if (focusAfterMoveRef.current !== orderId) return;
    focusAfterMoveRef.current = null;
    handleRef.current?.focus();
  }, [index, orderId, focusAfterMoveRef]);

  if (!order) return null;
  const held = order.onHold;

  const moveTo = (toIndex: number) => {
    focusAfterMoveRef.current = orderId;
    const moved = moveOrder({ planId, orderId, toIndex });
    save(moved);
    announce(`${shopName}の注文を${toIndex + 1}番目に移動しました`);
    return moved;
  };

  const onHandleKeyDown = (event: KeyboardEvent) => {
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (step === 0) return;
    event.preventDefault();
    setOpenOrderId(null);
    const toIndex = index + step;
    if (toIndex >= 0 && toIndex < count) void moveTo(toIndex);
  };

  const base = order.lineItems.reduce((sum, item) => sum + taxExcludedTarget(item), 0);
  const amount = order.lineItems.reduce((sum, item) => sum + taxIncludedTarget(item), 0);

  return (
    <List.Item data-order-id={orderId} borderTopWidth={index === 0 ? undefined : "1px"}>
      <Box
        // Painted, so a dragged row covers the rows it passes.
        bg="bg.panel"
        display="grid"
        gridTemplateColumns={rowColumns}
        alignItems="center"
        gap="2.5"
        px="3"
        minH="16"
        css={{ "&:has(> button[aria-expanded]:hover)": { bg: "bg.subtle" } }}
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
        {/* Everything right of the switch opens the row; the row lights up as it is pointed at. */}
        <Box
          as="button"
          type="button"
          gridColumn="3 / -1"
          alignSelf="stretch"
          display="grid"
          gridTemplateColumns="subgrid"
          alignItems="center"
          textAlign="start"
          cursor="pointer"
          aria-label={`${shopName}の注文の詳細と編集`}
          aria-expanded={open}
          aria-controls={detailId}
          onClick={() => setOpenOrderId(open ? null : orderId)}
        >
          <OrderBadge badge={props.badge} />
          <Flex minW="0" direction="column" gap="0.5">
            <Flex as="span" gap="2" fontSize="xs" color="fg.muted">
              <Text as="span" lineClamp={1} wordBreak="break-all">
                {shopName}
              </Text>
              <Text as="span" flex="none" fontVariantNumeric="tabular-nums">
                {monthDayWithWeekday(order.date)}
              </Text>
            </Flex>
            <Text as="span" fontSize="sm" fontWeight="medium" lineClamp={1} wordBreak="break-all">
              {orderTitle(order) ||
                (shopName === "ショップ未入力" ? `${monthDayWithWeekday(order.date)}の注文` : "")}
            </Text>
            {/* Kept, one chip high, on rows without campaigns so every closed row is as tall. */}
            <Flex as="span" wrap="wrap" gap="1" minH="5.5">
              {points.campaigns.map((label) => (
                <CampaignChip key={label}>{label}</CampaignChip>
              ))}
            </Flex>
          </Flex>
          <Flex direction="column" align="flex-end" fontSize="sm" fontVariantNumeric="tabular-nums">
            <span>{yen(amount)}</span>
            <Text as="span" fontSize="2xs" color="fg.muted">
              {taxLabel(order.lineItems)}
            </Text>
          </Flex>
          <Flex direction="column" align="flex-end" fontVariantNumeric="tabular-nums">
            {/* Held or not, two lines, so turning 購入決定 off leaves the row where it is. */}
            {held ? (
              <Text as="s" fontWeight="bold" color="fg.muted">
                <VisuallyHidden>保留中の見込み </VisuallyHidden>
                {pointsText(points.total)}
              </Text>
            ) : (
              <Text as="span" fontWeight="bold">
                {pointsText(points.total)}
              </Text>
            )}
            {/* Both labels share one cell, so the column is as wide whichever one shows. */}
            <Box display="grid" justifyItems="end" fontSize="2xs" color="fg.muted">
              <Text as="span" gridArea="1 / 1" visibility={held ? "hidden" : undefined}>
                {rateText(points.rate, false)}
              </Text>
              <Text as="span" gridArea="1 / 1" visibility={held ? undefined : "hidden"} aria-hidden>
                保留中
              </Text>
            </Box>
          </Flex>
          <Flex boxSize="11" align="center" justify="center" color="fg.muted">
            <ChevronIcon open={open} />
          </Flex>
        </Box>
      </Box>
      {/* It slides open and shut, so a press shows which order the fields below belong to. */}
      <Collapse open={open} unmountOnExit id={detailId}>
        <Flex direction="column" gap="3.5" borderTopWidth="1px" pt="3.5" pb="4" px="4">
          <Flex direction="column" gap="2">
            <PointBreakdown totals={groupTotalsOf(points.rows)} legend="line" held={held} />
            <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums">
              {`税抜の基準額 ${yen(base)}`}
            </Text>
          </Flex>
          <InlineOrderEditor planId={planId} order={order} />
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
});
