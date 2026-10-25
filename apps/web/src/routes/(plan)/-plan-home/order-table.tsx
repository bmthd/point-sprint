import type { Plan } from "@workspaces/domain";
import { Box, Flex, Card, List, Text, Tooltip, VisuallyHidden } from "@workspaces/ui";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { OrderAddForm } from "./order-add-form";
import { OrderListContext, OrderRow, rowColumns } from "./order-row";
import { HeaderButton, OrdersHeading, SaveFailedAlert, useOrderConfirm } from "../-order-shared";
import { ColumnHead } from "../../../ui/column-head";
import { useOrderDrag } from "./use-order-drag";

/**
 * The plan's orders on a wide screen: one row per order that opens into its breakdown and edit
 * fields, then 「＋ 注文を追加」. Rows never ask for more width than the column has. Counted orders
 * are numbered in list order; held ones get 「保留」 instead.
 */
/** What turning 購入決定 off does, shown on the column's heading and read with each switch. */
const HOLD_HINT =
  "オフにすると保留になり、買い回りの店舗数とポイントに数えません。買うか迷っている注文に使います。";

export function OrderTable({ plan, onEdit }: { plan: Plan; onEdit: (orderId: string) => void }) {
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
        <OrdersHeading orders={orders} headingRef={heading} id={headingId} />
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
        {orders.length > 0 ? (
          <Box
            display="grid"
            gridTemplateColumns={rowColumns}
            alignItems="center"
            gap="2.5"
            px="3"
            py="1.5"
            borderBottomWidth="1px"
            fontSize="xs"
            color="fg.muted"
            aria-hidden
          >
            <Tooltip content={HOLD_HINT}>
              <Text as="span" gridColumn="2" justifySelf="center" textDecoration="underline dotted">
                購入決定
              </Text>
            </Tooltip>
            <Text as="span" gridColumn="4">
              注文
            </Text>
            {/* Each row sizes its amount and points to its own text, so one heading spans both. */}
            <Text as="span" gridColumn="5 / 7" justifySelf="end">
              金額・ポイント
            </Text>
          </Box>
        ) : null}
        <List.Root
          ref={listRef}
          as="ol"
          aria-labelledby={headingId}
          gap="0"
          // The rows are laid out from the list's top, where a dragged row is measured from.
          position="relative"
          css={{
            // While a row is dragged, the others slide aside to leave room for it.
            "&[data-dragging] > li": {
              transitionProperty: "transform",
              transitionDuration: "moderate",
              transitionTimingFunction: "ease",
              _mediaReduceMotion: { transitionProperty: "none" },
            },
            "& > li[data-dragged]": { zIndex: "1", boxShadow: "md", transitionProperty: "none" },
          }}
        >
          <OrderListContext value={context}>
            {orders.map((order, index) => (
              <OrderRow
                key={order.id}
                planId={plan.id}
                orderId={order.id}
                badge={order.onHold ? null : ++counted}
                index={index}
                count={orders.length}
                onEdit={onEdit}
                onDelete={askDelete}
              />
            ))}
          </OrderListContext>
          <OrderAddForm plan={plan} />
        </List.Root>
      </Card.Root>
      <Text fontSize="xs" color="fg.muted">
        表示は目安です。実際の付与ポイントとは誤差が出ることがあります。入力した内容はこのブラウザの中に保存されます。
      </Text>
      {dialog}
    </Flex>
  );
}
