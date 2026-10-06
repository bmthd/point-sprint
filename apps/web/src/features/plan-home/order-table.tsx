import type { Plan } from "@workspaces/domain";
import { Box, Card, List, Text, VisuallyHidden } from "@workspaces/ui";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { OrderAddForm } from "./order-add-form";
import { OrderListContext, OrderRow } from "./order-row";
import { HeaderButton, OrdersHeading, SaveFailedAlert, useOrderConfirm } from "./order-shared";

/**
 * The plan's orders on a wide screen: one row per order that opens into its breakdown and edit
 * fields, then 「＋ 注文を追加」. Rows never ask for more width than the column has. Counted orders
 * are numbered in list order; held ones get 「保留」 instead.
 */
export function OrderTable({ plan, onEdit }: { plan: Plan; onEdit: (orderId: string) => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  const handleHintId = useId();
  const { askDelete, askReset, dialog } = useOrderConfirm(plan, heading);
  const [announcement, setAnnouncement] = useState("");
  const dragged = useRef<{ orderId: string; index: number; shopName: string } | null>(null);
  const focusAfterMove = useRef<string | null>(null);
  const announce = useCallback((message: string) => setAnnouncement(message), []);
  const context = useMemo(
    () => ({ dragged, focusAfterMove, announce, handleHintId }),
    [announce, handleHintId],
  );

  const orders = plan.orders;
  let counted = 0;

  return (
    <Box display="flex" flexDirection="column" gap="2.5">
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <OrdersHeading orders={orders} headingRef={heading} id={headingId} />
        <HeaderButton disabled={orders.length === 0} onClick={askReset}>
          リセット
        </HeaderButton>
      </Box>
      <SaveFailedAlert />
      <VisuallyHidden id={handleHintId}>
        ドラッグするか、上下の矢印キーで順番を変えられます。
      </VisuallyHidden>
      <VisuallyHidden role="status">{announcement}</VisuallyHidden>
      <Card.Root variant="outline" overflow="hidden">
        <List.Root as="ol" aria-labelledby={headingId} gap="0">
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
        表示は目安です。実際の付与ポイントとは誤差が出ることがあります。入力した内容はこのブラウザの中にだけ保存されます。
      </Text>
      {dialog}
    </Box>
  );
}
