import type { Plan } from "@workspaces/domain";
import { Box, Button, List, Text } from "@workspaces/ui";
import { useAtom } from "jotai";
import { useRef } from "react";
import { reorderModeAtom } from "../../state/ui";
import { PlusIcon } from "./icons";
import { OrderCard } from "./order-card";
import { HeaderButton, OrdersHeading, SaveFailedAlert, useOrderConfirm } from "./order-shared";

/**
 * The plan's orders as cards (the phone layout). Counted orders are numbered in list order; held
 * ones get 「保留」 instead.
 */
export function OrderList({
  plan,
  onEdit,
  onAdd,
}: {
  plan: Plan;
  onEdit: (orderId: string) => void;
  /** Shown as a button under the list when the screen has no bottom bar to add from. */
  onAdd?: (() => void) | undefined;
}) {
  const [reordering, setReordering] = useAtom(reorderModeAtom);
  const heading = useRef<HTMLHeadingElement>(null);
  const { askDelete, askReset, dialog } = useOrderConfirm(plan, heading);

  const orders = plan.orders;
  let counted = 0;

  return (
    <Box display="flex" flexDirection="column" gap="2.5">
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <OrdersHeading orders={orders} headingRef={heading} />
        <Box display="flex">
          <HeaderButton
            pressed={reordering}
            disabled={!reordering && orders.length < 2}
            onClick={() => setReordering(!reordering)}
          >
            {reordering ? "完了" : "並べ替え"}
          </HeaderButton>
          <HeaderButton disabled={orders.length === 0} onClick={askReset}>
            リセット
          </HeaderButton>
        </Box>
      </Box>
      <SaveFailedAlert />
      {orders.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          まだ注文がありません。「注文を追加」から入れられます。
        </Text>
      ) : (
        <List.Root aria-label="注文" gap="2.5">
          {orders.map((order, index) => (
            <OrderCard
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
        </List.Root>
      )}
      {onAdd ? (
        <Button
          variant="outline"
          colorScheme="primary"
          size="xl"
          onClick={onAdd}
          startIcon={<PlusIcon />}
        >
          注文を追加
        </Button>
      ) : null}
      {dialog}
    </Box>
  );
}
