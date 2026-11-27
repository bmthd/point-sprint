import { selectAtom } from "jotai/utils";
import { type Plan, deepEqual } from "@workspaces/domain";
import { planAtom } from "#/state/derived.ts";
import { Box, Card, Flex, List, Text, VisuallyHidden } from "@workspaces/ui";
import { useAtom, useAtomValue } from "jotai";
import { type ReactNode, useId, useRef } from "react";

import { reorderModeAtom } from "#/routes/(plan)/-ui.ts";
import { orderBadges, withMonthSeparators } from "./order-months.tsx";
import { HoldHintContext, OrderCard } from "./order-card.tsx";
import {
  HOLD_HINT,
  HeaderButton,
  OrdersHeading,
  SaveFailedAlert,
  useOrderConfirm,
} from "#/routes/(plan)/-order-shared.tsx";
import { ColumnHead } from "#/ui/column-head.tsx";

/**
 * The phone's table of orders: one card with the columns' names over the rows, in the desktop
 * table's order. The rows are `children`, list items of `OrderCard`.
 */
export function OrderListTable({ children }: { children: ReactNode }) {
  const holdHintId = useId();
  return (
    <Card.Root overflow="hidden">
      <VisuallyHidden id={holdHintId}>{HOLD_HINT}</VisuallyHidden>
      {/* The columns' names, for the eye: each switch and row is named on its own. */}
      <Flex
        align="center"
        gap="2"
        px="3"
        py="1.5"
        borderBottomWidth="1px"
        fontSize="xs"
        color="fg.muted"
        aria-hidden
      >
        <Box as="span" w="11" ms="-2" textAlign="center" whiteSpace="nowrap">
          購入決定
        </Box>
        <Box as="span" flex="1" ps="10">
          注文
        </Box>
        <Box as="span" pe="6">
          ポイント
        </Box>
      </Flex>
      <List.Root
        aria-label="注文"
        gap="0"
        // A line between the rows and the months' separators.
        _notFirstChild={{ borderTopWidth: "1px" }}
      >
        <HoldHintContext value={holdHintId}>{children}</HoldHintContext>
      </List.Root>
    </Card.Root>
  );
}

/**
 * The plan's orders as a table of rows in one card (the phone layout), in the desktop table's
 * order: 購入決定, the position, the order, its points. Counted orders are numbered in list order;
 * held ones get 「保留」 instead.
 */
export function OrderList({
  planId,
  onEdit,
  onSpu,
}: {
  planId: string;
  onEdit: (orderId: string) => void;
  /** Opens a month's SPU from the month's separator, when the orders are of more than one month. */
  onSpu?: ((month: string) => void) | undefined;
}) {
  const orders = useAtomValue(selectAtom(planAtom(planId), orderMetadata, deepEqual));
  const [reordering, setReordering] = useAtom(reorderModeAtom);
  const heading = useRef<HTMLHeadingElement>(null);
  const { askDelete, askReset, dialog } = useOrderConfirm(planId, heading, orders.length);

  const badges = orderBadges(orders);

  return (
    <Flex direction="column" gap="2.5">
      <ColumnHead>
        <OrdersHeading orders={orders} headingRef={heading} />
        <Flex>
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
        </Flex>
      </ColumnHead>
      <SaveFailedAlert />
      {orders.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          まだ注文がありません。「注文を追加」から入れられます。
        </Text>
      ) : (
        <OrderListTable>
          {withMonthSeparators({
            planId,
            orders,
            onSpu,
            items: orders.map((order, index) => (
              <OrderCard
                key={order.id}
                planId={planId}
                orderId={order.id}
                badge={badges[index] ?? null}
                index={index}
                count={orders.length}
                onEdit={onEdit}
                onDelete={askDelete}
              />
            )),
            separator: { px: "3", py: "1", bg: "bg.subtle" },
          })}
        </OrderListTable>
      )}
      {dialog}
    </Flex>
  );
}

const orderMetadata = (plan: Plan | undefined) =>
  plan?.orders.map(({ id, date, onHold }) => ({ id, date, onHold })) ?? [];
