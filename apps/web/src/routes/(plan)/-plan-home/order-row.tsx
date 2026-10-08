import {
  type LineItem,
  type Order,
  type OrderTag,
  type Shop,
  taxExcludedTarget,
  taxIncludedTarget,
} from "@workspaces/domain";
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  List,
  NativeSelect,
  Text,
  VisuallyHidden,
} from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import {
  type DragEvent,
  type KeyboardEvent,
  type RefObject,
  createContext,
  memo,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import * as v from "valibot";
import { orderAtom } from "../../../state/derived";
import { changeShop, saveShopAtom } from "../../../state/mutations";
import {
  copyOrderAtom,
  moveOrderAtom,
  toggleHoldAtom,
  updateOrderAtom,
} from "../../../state/order-ops";
import { shopsAtom } from "../../../state/queries";
import { openOrderIdAtom } from "../../../state/ui";
import { monthDayWithWeekday } from "../../../ui/dates";
import { ChevronIcon, GripIcon } from "../../../ui/icons";
import { CommitField } from "../../../form/commit-field";
import {
  AmountSchema,
  ItemNameSchema,
  OrderDateSchema,
  ShopRateSchema,
} from "../../../form/field-schemas";
import {
  Field,
  ReadOnlyField,
  TaxRateOptions,
  type TaxRateValue,
  ToggleChip,
  fieldGrid,
  withTag,
  taxRateValue,
  useSortedShops,
} from "../-order-fields";
import { FieldDatePicker, isoDate, parseIsoDate } from "../-date-picker-field";
import {
  CampaignChip,
  OrderBadge,
  groupTotalsOf,
  isOpenAtom,
  orderCardPointsAtom,
  orderTitle,
  pointsText,
  rateText,
  taxLabel,
  taxRateLabel,
  useSaveOrderChange,
  useShopName,
  yen,
} from "../-order-shared";
import { PointBreakdown } from "./point-breakdown";

/** What the list shares with its rows without re-rendering them: refs and stable callbacks. */
export type OrderListContext = {
  /** The order being dragged by its handle, if any. */
  draggedRef: RefObject<{ orderId: string; index: number; shopName: string } | null>;
  /** The order whose handle gets the focus back once it has moved. */
  focusAfterMoveRef: RefObject<string | null>;
  /** Says where an order moved, through the list's live region. */
  announce: (message: string) => void;
  /** The id of the text that explains the arrow keys on a handle. */
  handleHintId: string;
};

export const OrderListContext = createContext<OrderListContext | null>(null);

const useListContext = () => {
  const context = useContext(OrderListContext);
  if (!context) throw new Error("OrderRow must be rendered inside an OrderTable");
  return context;
};

/** The columns of a closed row. Only the middle one (shop, item, campaigns) grows and shrinks. */
export const rowColumns = "44px 44px 36px minmax(0, 1fr) auto auto 44px";

const withItems = (order: Order, change: (item: LineItem) => LineItem): Order => ({
  ...order,
  lineItems: order.lineItems.map(change),
});

const withShopRate = (order: Order, rate: number | undefined) =>
  withItems(order, (item) => {
    const next = { ...item, shopPointRate: rate };
    if (rate === undefined) delete next.shopPointRate;
    return next;
  });

const VARIES = "商品ごとに異なります";

/** The one value all items share, or 「商品ごとに異なります」. */
const sharedValue = <T,>(
  items: LineItem[],
  of: (item: LineItem) => T,
  label: (value: T) => string,
) => {
  const values = new Set(items.map(of));
  return values.size === 1 ? label([...values][0] as T) : VARIES;
};

const toggleTag = <T extends string>(tags: T[], tag: T): T[] =>
  tags.includes(tag) ? tags.filter((other) => other !== tag) : [...tags, tag];

/**
 * The order's fields, edited in place. Each change is saved on its own, and only when it is
 * valid. The item name and amount are edited here only for an order of one item.
 */
function OrderEditor({
  planId,
  order,
  onEdit,
}: {
  planId: string;
  order: Order;
  onEdit: (orderId: string) => void;
}) {
  const shops = useAtomValue(shopsAtom);
  const sortedShops = useSortedShops(shops);
  const saveShop = useAtomValue(saveShopAtom);
  const updateOrder = useSetAtom(updateOrderAtom);
  const save = useSaveOrderChange();
  const shop: Shop | undefined = shops.find((other) => other.id === order.shopId);
  const [item] = order.lineItems;
  const single = order.lineItems.length === 1 && item ? item : undefined;
  const [dateError, setDateError] = useState<string>();
  const shopTagHintId = useId();

  const saveOrder = (next: Order) => {
    const saving = updateOrder({ planId, order: next });
    save(saving);
    return saving;
  };

  return (
    <>
      <Box {...fieldGrid}>
        <Field label="ショップ">
          <NativeSelect.Root
            size="lg"
            value={order.shopId}
            onChange={(event) => saveOrder({ ...order, shopId: event.currentTarget.value })}
          >
            {shop ? null : <option value={order.shopId}>不明なショップ</option>}
            {sortedShops.map((other) => (
              <option key={other.id} value={other.id}>
                {other.name}
              </option>
            ))}
          </NativeSelect.Root>
        </Field>
        <Field label="注文日" error={dateError}>
          <FieldDatePicker
            size="lg"
            defaultValue={parseIsoDate(order.date)}
            key={order.date}
            onChange={(date) => {
              const parsed = v.safeParse(OrderDateSchema, date ? isoDate(date) : "");
              setDateError(parsed.success ? undefined : parsed.issues[0].message);
              if (parsed.success && parsed.output !== order.date) {
                saveOrder({ ...order, date: parsed.output });
              }
            }}
          />
        </Field>
        {single ? (
          <>
            <CommitField
              key={`name:${single.name}`}
              label="商品名メモ"
              initial={single.name}
              schema={ItemNameSchema}
              onCommit={(name) =>
                saveOrder(withItems(order, (lineItem) => ({ ...lineItem, name })))
              }
            />
            <CommitField
              key={`amount:${taxIncludedTarget(single)}`}
              label="金額（税込）"
              initial={taxIncludedTarget(single).toLocaleString("ja-JP")}
              schema={AmountSchema}
              inputMode="numeric"
              align="end"
              onCommit={(amount) =>
                saveOrder(
                  withItems(order, (lineItem) => ({
                    ...lineItem,
                    unitPrice: amount,
                    quantity: 1,
                    discount: 0,
                  })),
                )
              }
            />
          </>
        ) : null}
        {single ? (
          <>
            <Field label="税率">
              <NativeSelect.Root
                size="lg"
                value={taxRateValue(single.taxRate)}
                onChange={(event) => {
                  const taxRate = Number(
                    event.currentTarget.value as TaxRateValue,
                  ) as LineItem["taxRate"];
                  saveOrder(withItems(order, (lineItem) => ({ ...lineItem, taxRate })));
                }}
              >
                <TaxRateOptions />
              </NativeSelect.Root>
            </Field>
            <CommitField
              key={`rate:${single.shopPointRate ?? ""}`}
              label="ショップ独自倍率"
              initial={single.shopPointRate === undefined ? "" : String(single.shopPointRate)}
              schema={ShopRateSchema}
              inputMode="decimal"
              align="end"
              placeholder="1"
              onCommit={(rate) => saveOrder(withShopRate(order, rate))}
            />
          </>
        ) : (
          // Each item keeps its own rates; they are changed one item at a time in 「商品を編集」.
          <>
            <ReadOnlyField
              label="税率"
              value={sharedValue(order.lineItems, (lineItem) => lineItem.taxRate, taxRateLabel)}
            />
            <ReadOnlyField
              label="ショップ独自倍率"
              value={sharedValue(
                order.lineItems,
                (lineItem) => lineItem.shopPointRate,
                (rate) => (rate === undefined ? "なし" : `${rate}倍`),
              )}
            />
          </>
        )}
      </Box>
      {single ? null : (
        <Text fontSize="xs" color="fg.muted">
          商品が{order.lineItems.length}
          点あるので、商品名・金額・税率・ショップ独自倍率は「商品を編集」から変えられます。
        </Text>
      )}
      <Box display="flex" flexWrap="wrap" gap="2">
        <ToggleChip
          pressed={shop?.tags.includes("39shop") ?? false}
          describedBy={shopTagHintId}
          onClick={() => {
            if (!shop) return;
            const on = !shop.tags.includes("39shop");
            save(
              saveShop.mutateAsync(
                changeShop(shop.id, (current) => ({
                  ...current,
                  tags: withTag(current.tags, "39shop", on),
                })),
              ),
            );
          }}
        >
          39ショップ
        </ToggleChip>
        <Text id={shopTagHintId} alignSelf="center" fontSize="xs" color="fg.muted">
          このショップの注文すべてに反映されます
        </Text>
        <ToggleChip
          pressed={order.tags.includes("repeat")}
          onClick={() => saveOrder({ ...order, tags: toggleTag<OrderTag>(order.tags, "repeat") })}
        >
          リピート購入
        </ToggleChip>
        <Box flex="1" />
        {single ? null : (
          <Button variant="outline" size="lg" onClick={() => onEdit(order.id)}>
            商品を編集
          </Button>
        )}
      </Box>
    </>
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
  onEdit: (orderId: string) => void;
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
  const shopName = useShopName(order?.shopId ?? "");
  const { draggedRef, focusAfterMoveRef, announce, handleHintId } = useListContext();
  const detailId = useId();
  const handleRef = useRef<HTMLButtonElement>(null);
  const [dropSide, setDropSide] = useState<"before" | "after" | null>(null);
  const [grabbed, setGrabbed] = useState(false);

  // A press on the handle that ends without a drag disarms the row again.
  useEffect(() => {
    if (!grabbed) return;
    const release = () => setGrabbed(false);
    document.addEventListener("pointerup", release);
    return () => document.removeEventListener("pointerup", release);
  }, [grabbed]);

  // Moving an order can take its row out of the document for a moment, which drops the focus.
  useEffect(() => {
    if (focusAfterMoveRef.current !== orderId) return;
    focusAfterMoveRef.current = null;
    handleRef.current?.focus();
  }, [index, orderId, focusAfterMoveRef]);

  if (!order) return null;
  const held = order.onHold;

  const onHandleKeyDown = (event: KeyboardEvent) => {
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const toIndex = index + step;
    if (toIndex < 0 || toIndex >= count) return;
    focusAfterMoveRef.current = orderId;
    save(moveOrder({ planId, orderId, toIndex }));
    announce(`${shopName}の注文を${toIndex + 1}番目に移動しました`);
  };

  const onDragOver = (event: DragEvent) => {
    const dragged = draggedRef.current;
    if (!dragged || dragged.orderId === orderId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropSide(dragged.index < index ? "after" : "before");
  };

  const onDrop = (event: DragEvent) => {
    const dragged = draggedRef.current;
    setDropSide(null);
    if (!dragged || dragged.orderId === orderId) return;
    event.preventDefault();
    draggedRef.current = null;
    save(moveOrder({ planId, orderId: dragged.orderId, toIndex: index }));
    announce(`${dragged.shopName}の注文を${index + 1}番目に移動しました`);
  };

  const base = order.lineItems.reduce((sum, item) => sum + taxExcludedTarget(item), 0);
  const amount = order.lineItems.reduce((sum, item) => sum + taxIncludedTarget(item), 0);

  return (
    <List.Item
      data-order-id={orderId}
      borderTopWidth={index === 0 ? undefined : "1px"}
      // Shows where a dragged order will land.
      boxShadow={
        dropSide === "before"
          ? "inset 0 2px 0 0 {colors.primary.solid}"
          : dropSide === "after"
            ? "inset 0 -2px 0 0 {colors.primary.solid}"
            : undefined
      }
      draggable={grabbed}
      onDragStart={(event: DragEvent) => {
        draggedRef.current = { orderId, index, shopName };
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", shopName);
      }}
      onDragEnd={() => {
        draggedRef.current = null;
        setGrabbed(false);
      }}
      onDragOver={onDragOver}
      onDragLeave={(event: DragEvent) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropSide(null);
      }}
      onDrop={onDrop}
    >
      <Box
        display="grid"
        gridTemplateColumns={rowColumns}
        alignItems="center"
        gap="2.5"
        px="3"
        py="2"
        minH="16"
      >
        <IconButton
          ref={handleRef}
          variant="ghost"
          size="lg"
          colorScheme="gray"
          cursor="grab"
          aria-label={`${shopName}の注文を並べ替え`}
          aria-describedby={handleHintId}
          onKeyDown={onHandleKeyDown}
          // The row is dragged, but only when the drag starts on its handle.
          onPointerDown={() => setGrabbed(true)}
          // Browsers cancel the pointer when a drag starts; only a cancel outside a drag disarms.
          onPointerCancel={() => {
            if (!draggedRef.current) setGrabbed(false);
          }}
        >
          <GripIcon />
        </IconButton>
        <Checkbox
          size="lg"
          colorScheme="primary"
          boxSize="11"
          justifyContent="center"
          cursor="pointer"
          checked={!held}
          inputProps={{ "aria-label": `${shopName}の注文を買い回りにカウント` }}
          onChange={() => save(toggleHold({ planId, orderId }))}
        />
        <OrderBadge badge={props.badge} />
        <Box minW="0" display="flex" flexDirection="column" gap="0.5">
          <Box as="span" display="flex" gap="2" fontSize="xs" color="fg.muted">
            <Text as="span" lineClamp={1} wordBreak="break-all">
              {shopName}
            </Text>
            <Text as="span" flex="none" fontVariantNumeric="tabular-nums">
              {monthDayWithWeekday(order.date)}
            </Text>
          </Box>
          <Text as="span" fontSize="sm" fontWeight="medium" lineClamp={1} wordBreak="break-all">
            {orderTitle(order)}
          </Text>
          {points.campaigns.length > 0 ? (
            <Box as="span" display="flex" flexWrap="wrap" gap="1">
              {points.campaigns.map((label) => (
                <CampaignChip key={label}>{label}</CampaignChip>
              ))}
            </Box>
          ) : null}
        </Box>
        <Box
          display="flex"
          flexDirection="column"
          alignItems="flex-end"
          fontSize="sm"
          fontVariantNumeric="tabular-nums"
        >
          <span>{yen(amount)}</span>
          <Text as="span" fontSize="2xs" color="fg.muted">
            {taxLabel(order.lineItems)}
          </Text>
        </Box>
        <Box
          display="flex"
          flexDirection="column"
          alignItems="flex-end"
          fontVariantNumeric="tabular-nums"
        >
          {held ? (
            <Text as="s" fontWeight="bold" color="fg.muted">
              <VisuallyHidden>保留中の見込み </VisuallyHidden>
              {pointsText(points.estimate ?? 0)}
            </Text>
          ) : (
            <>
              <Text as="span" fontWeight="bold">
                {pointsText(points.total)}
              </Text>
              <Text as="span" fontSize="2xs" color="fg.muted">
                {rateText(points.rate, false)}
              </Text>
            </>
          )}
        </Box>
        <IconButton
          variant="ghost"
          size="lg"
          colorScheme="gray"
          aria-label={`${shopName}の注文の詳細と編集`}
          aria-expanded={open}
          aria-controls={detailId}
          onClick={() => setOpenOrderId(open ? null : orderId)}
        >
          <ChevronIcon open={open} />
        </IconButton>
      </Box>
      <Box
        id={detailId}
        hidden={!open}
        display={open ? "flex" : "none"}
        flexDirection="column"
        gap="3.5"
        borderTopWidth="1px"
        pt="3.5"
        pb="4"
        pr="4"
        pl="120px"
      >
        {open ? (
          <>
            <Box display="flex" flexDirection="column" gap="2">
              {held ? (
                <Text fontSize="sm" color="fg.muted">
                  保留中の注文は合計と買い回りに入りません。
                </Text>
              ) : (
                <PointBreakdown totals={groupTotalsOf(points.rows)} legend="line" />
              )}
              <Text fontSize="xs" color="fg.muted" fontVariantNumeric="tabular-nums">
                {`税抜の基準額 ${yen(base)}`}
              </Text>
            </Box>
            <OrderEditor planId={planId} order={order} onEdit={props.onEdit} />
            <Box display="flex" flexWrap="wrap" gap="2" justifyContent="flex-end">
              <Button
                variant="outline"
                size="lg"
                onClick={() => save(copyOrder({ planId, orderId }))}
              >
                コピー
              </Button>
              <Button
                variant="outline"
                size="lg"
                colorScheme="danger"
                onClick={() => props.onDelete(orderId)}
              >
                削除
              </Button>
            </Box>
          </>
        ) : null}
      </Box>
    </List.Item>
  );
});
