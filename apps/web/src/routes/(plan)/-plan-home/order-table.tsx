import type { Plan } from "@workspaces/domain";
import { Box, Flex, Card, List, Text, Tooltip, VisuallyHidden } from "@workspaces/ui";
import { type ReactNode, useCallback, useId, useMemo, useRef, useState } from "react";
import { OrderAddRow } from "./order-add-row.tsx";
import { withMonthSeparators } from "./order-months.tsx";
import { ROW_GAP } from "./inline-text.tsx";
import { OrderListContext, OrderRow, rowColumns } from "./order-row.tsx";
import {
  HOLD_HINT,
  HeaderButton,
  OrdersHeading,
  SaveFailedAlert,
  useOrderConfirm,
} from "#/routes/(plan)/-order-shared.tsx";
import { ColumnHead } from "#/ui/column-head.tsx";
import { useOrderDrag } from "./use-order-drag.ts";

/**
 * The plan's orders on a wide screen: one row per order that opens into its breakdown and edit
 * fields, then the empty row a new order is typed in. Rows never ask for more width than the column has. Counted orders
 * are numbered in list order; held ones get 「保留」 instead.
 */
export function OrderTable({
  plan,
  head,
  onSpu,
}: {
  plan: Plan;
  /** What the column starts with, left of 「リセット」: the plan's name. */
  head: ReactNode;
  /** Opens a month's SPU from the month's separator, when the orders are of more than one month. */
  onSpu?: ((month: string) => void) | undefined;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const handleHintId = useId();
  const holdHintId = useId();
  const { askDelete, askReset, dialog } = useOrderConfirm(plan, heading);
  const [announcement, setAnnouncement] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const orders = plan.orders;
  const startDrag = useOrderDrag({ listRef, orders });
  const focusAfterMoveRef = useRef<string | null>(null);
  const announce = useCallback((message: string) => setAnnouncement(message), []);
  const context = useMemo(
    () => ({ startDrag, focusAfterMoveRef, announce, handleHintId, holdHintId }),
    [startDrag, announce, handleHintId, holdHintId],
  );

  let counted = 0;

  return (
    <Flex direction="column" gap="2.5">
      <ColumnHead>
        {head}
        <HeaderButton disabled={orders.length === 0} onClick={askReset}>
          リセット
        </HeaderButton>
      </ColumnHead>
      <SaveFailedAlert />
      <VisuallyHidden id={handleHintId}>
        ドラッグするか、上下の矢印キーで順番を変えられます。
      </VisuallyHidden>
      <VisuallyHidden id={holdHintId}>{HOLD_HINT}</VisuallyHidden>
      <VisuallyHidden role="status">{announcement}</VisuallyHidden>
      <Card.Root overflow="hidden">
        {/* The column starts with the plan's name, so the orders' heading is the label of their column. */}
        <Box
          display="grid"
          gridTemplateColumns={rowColumns}
          alignItems="center"
          gap={ROW_GAP}
          px="3"
          py="1.5"
          borderBottomWidth="1px"
          fontSize="xs"
          color="fg.muted"
        >
          {orders.length > 0 ? (
            <Tooltip content={HOLD_HINT}>
              <Text
                as="span"
                gridColumn="2"
                justifySelf="center"
                textDecoration="underline dotted"
                aria-hidden
              >
                購入決定
              </Text>
            </Tooltip>
          ) : null}
          {/* Alone, without the columns' names, the heading spans the row. */}
          <Box gridColumn="4" color="fg" _onlyChild={{ gridColumn: "1 / 5" }}>
            <OrdersHeading orders={orders} headingRef={heading} id={headingId} small />
          </Box>
          {orders.length > 0 ? (
            <>
              <Text as="span" gridColumn="5" justifySelf="end" aria-hidden>
                金額
              </Text>
              <Text as="span" gridColumn="6" justifySelf="end" aria-hidden>
                ポイント
              </Text>
            </>
          ) : null}
        </Box>
        <List.Root
          ref={listRef}
          as="ol"
          aria-labelledby={headingId}
          gap="0"
          // The rows are laid out from the list's top, where a dragged row is measured from.
          position="relative"
          css={{
            // A line above each order but the first, and above the add row after the orders. A
            // month's separator draws its own line under it.
            "& > li[data-order-id] ~ li:is([data-order-id], :last-child)": {
              borderTopWidth: "1px",
            },
            // While a row is dragged, the others slide aside to leave room for it.
            "&[data-dragging] > li:not([data-grabbed])": {
              transitionProperty: "transform",
              transitionDuration: "moderate",
              transitionTimingFunction: "ease",
              _mediaReduceMotion: { transitionProperty: "none" },
            },
          }}
        >
          <OrderListContext value={context}>
            {withMonthSeparators({
              plan,
              onSpu,
              items: orders.map((order, index) => (
                <OrderRow
                  key={order.id}
                  planId={plan.id}
                  orderId={order.id}
                  badge={order.onHold ? null : ++counted}
                  index={index}
                  count={orders.length}
                  onDelete={askDelete}
                />
              )),
              // A separator is not a row: dragging measures only the rows (`li[data-order-id]`).
              separator: { px: "3", py: "1", bg: "bg.subtle", borderBottomWidth: "1px" },
            })}
          </OrderListContext>
          <OrderAddRow plan={plan} />
        </List.Root>
      </Card.Root>
      <Text fontSize="xs" color="fg.muted">
        表示は目安です。実際の付与ポイントとは誤差が出ることがあります。入力した内容はこのブラウザの中に保存されます。
      </Text>
      {dialog}
    </Flex>
  );
}
