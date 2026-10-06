import { taxExcludedTarget, taxIncludedTarget } from "@workspaces/domain";
import { Box, Button, Card, IconButton, List, Switch, Text, VisuallyHidden } from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { memo, useId, useMemo, useRef } from "react";
import { orderAtom } from "../../state/derived";
import { copyOrderAtom, moveOrderAtom, toggleHoldAtom } from "../../state/order-ops";
import { openOrderIdAtom, reorderModeAtom } from "../../state/ui";
import { monthDayWithWeekday } from "../plan-list/dates";
import { ArrowIcon, ChevronIcon } from "./icons";
import {
  CampaignChip,
  OrderBadge,
  isOpenAtom,
  orderCardPointsAtom,
  orderTitle,
  pointsText,
  rateText,
  taxLabel,
  useSaveOrderChange,
  useShopName,
  yen,
} from "./order-shared";
import { pointFill } from "./point-breakdown";

export type OrderCardProps = {
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

/** One order on the phone's order list. Only one card is open at a time. */
export const OrderCard = memo(function OrderCard(props: OrderCardProps) {
  const { planId, orderId, index } = props;
  const key = useMemo(() => ({ planId, orderId }), [planId, orderId]);
  const order = useAtomValue(orderAtom(key));
  const points = useAtomValue(orderCardPointsAtom(key));
  const open = useAtomValue(isOpenAtom(orderId));
  const reordering = useAtomValue(reorderModeAtom);
  const setOpenOrderId = useSetAtom(openOrderIdAtom);
  const save = useSaveOrderChange();
  const toggleHold = useSetAtom(toggleHoldAtom);
  const copyOrder = useSetAtom(copyOrderAtom);
  const moveOrder = useSetAtom(moveOrderAtom);
  const shopName = useShopName(order?.shopId ?? "");
  const bodyId = useId();
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);

  if (!order) return null;
  const held = order.onHold;

  const move = (toIndex: number) => {
    save(moveOrder({ planId, orderId, toIndex }));
    // The button that moved the order to an end is disabled next; keep the focus on the card.
    if (toIndex === 0) downRef.current?.focus();
    if (toIndex === props.count - 1) upRef.current?.focus();
  };

  const base = order.lineItems.reduce((sum, item) => sum + taxExcludedTarget(item), 0);
  const amount = order.lineItems.reduce((sum, item) => sum + taxIncludedTarget(item), 0);

  return (
    <Card.Root
      as="li"
      variant="outline"
      // A held order is told apart by its dashed frame, as well as its 「保留」 badge.
      borderStyle={held ? "dashed" : undefined}
      overflow="hidden"
    >
      <Box display="flex" alignItems="center">
        <Button
          variant="ghost"
          colorScheme="gray"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpenOrderId(open ? null : orderId)}
          flex="1"
          minW="0"
          gap="2.5"
          // The header holds three lines of text; a button is one line tall and does not wrap.
          h="auto"
          py="3"
          whiteSpace="normal"
          textAlign="start"
          lineHeight="normal"
        >
          <OrderBadge badge={props.badge} />
          <Box as="span" flex="1" minW="0" display="flex" flexDirection="column" gap="0.5">
            <Box as="span" display="flex" gap="1.5" fontSize="xs" color="fg.muted">
              <Text as="span" lineClamp={1}>
                {shopName}
              </Text>
              <Text as="span" flex="none" fontVariantNumeric="tabular-nums">
                {monthDayWithWeekday(order.date)}
              </Text>
            </Box>
            <Text as="span" fontSize="sm" fontWeight="medium" lineClamp={1}>
              {orderTitle(order)}
            </Text>
            <Box
              as="span"
              display="flex"
              alignItems="center"
              flexWrap="wrap"
              gap="1.5"
              fontSize="xs"
              color="fg.muted"
            >
              <Text as="span" fontVariantNumeric="tabular-nums">
                {yen(amount)}
              </Text>
              <span>{taxLabel(order.lineItems)}</span>
              {points.campaigns.map((label) => (
                <CampaignChip key={label}>{label}</CampaignChip>
              ))}
            </Box>
          </Box>
          <Box
            as="span"
            display="flex"
            flexDirection="column"
            alignItems="flex-end"
            gap="0.5"
            fontVariantNumeric="tabular-nums"
          >
            {held ? (
              <Text as="s" fontSize="md" fontWeight="bold" color="fg.muted">
                <VisuallyHidden>保留中の見込み </VisuallyHidden>
                {pointsText(points.estimate ?? 0)}
              </Text>
            ) : (
              <>
                <Text as="span" fontSize="md" fontWeight="bold">
                  {pointsText(points.total)}
                </Text>
                <Text as="span" fontSize="2xs" color="fg.muted">
                  {rateText(points.rate, false)}
                </Text>
              </>
            )}
          </Box>
          <Box as="span" color="fg.muted" display="flex">
            <ChevronIcon open={open} />
          </Box>
        </Button>
        {reordering ? (
          <Box display="flex" flex="none" pr="1">
            <IconButton
              ref={upRef}
              variant="ghost"
              size="lg"
              colorScheme="gray"
              aria-label={`${shopName}を上へ`}
              disabled={index === 0}
              onClick={() => move(index - 1)}
            >
              <ArrowIcon direction="up" />
            </IconButton>
            <IconButton
              ref={downRef}
              variant="ghost"
              size="lg"
              colorScheme="gray"
              aria-label={`${shopName}を下へ`}
              disabled={index === props.count - 1}
              onClick={() => move(index + 1)}
            >
              <ArrowIcon direction="down" />
            </IconButton>
          </Box>
        ) : null}
      </Box>
      <Box
        id={bodyId}
        hidden={!open}
        borderTopWidth="1px"
        borderColor="border"
        p="3"
        display={open ? "flex" : "none"}
        flexDirection="column"
        gap="2.5"
      >
        {open ? (
          <>
            <List.Root aria-label="商品" gap="1" fontSize="sm">
              {order.lineItems.map((item) => (
                <List.Item key={item.id} display="flex" justifyContent="space-between" gap="2">
                  <span>
                    {item.name}{" "}
                    <Text as="span" color="fg.muted" fontVariantNumeric="tabular-nums">
                      ×{item.quantity}
                    </Text>
                  </span>
                  <Text as="span" fontVariantNumeric="tabular-nums">
                    {yen(taxIncludedTarget(item))}
                  </Text>
                </List.Item>
              ))}
            </List.Root>
            <Box display="flex" justifyContent="space-between" fontSize="xs" color="fg.muted">
              <span>税抜の基準額</span>
              <Text as="span" fontVariantNumeric="tabular-nums">
                {yen(base)}
              </Text>
            </Box>
            {held ? (
              <Text fontSize="sm" color="fg.muted">
                保留中の注文は合計と買い回りに入りません。
              </Text>
            ) : (
              <Box display="flex" flexDirection="column" gap="1.5" fontSize="sm">
                {points.rows.map((row) => (
                  <Box
                    key={row.key}
                    data-row="benefit"
                    display="grid"
                    gridTemplateColumns="14px 1fr 56px 56px"
                    alignItems="center"
                    gap="2"
                  >
                    <Box boxSize="2.5" rounded="xs" bg={pointFill(row.group, 2)} aria-hidden />
                    <span>{row.label}</span>
                    <Text
                      as="span"
                      textAlign="end"
                      color="fg.muted"
                      fontVariantNumeric="tabular-nums"
                    >
                      {rateText(row.rate, row.group !== "base")}
                    </Text>
                    <Text
                      as="span"
                      textAlign="end"
                      fontWeight="medium"
                      fontVariantNumeric="tabular-nums"
                    >
                      {pointsText(row.points)}
                    </Text>
                  </Box>
                ))}
              </Box>
            )}
            <Switch
              checked={!held}
              onChange={() => save(toggleHold({ planId, orderId }))}
              colorScheme="primary"
              flexDirection="row-reverse"
              justifyContent="space-between"
            >
              買い回りにカウント（オフで保留）
            </Switch>
            <Box display="grid" gridTemplateColumns="repeat(3, minmax(0, 1fr))" gap="2">
              <Button variant="outline" size="lg" onClick={() => props.onEdit(orderId)}>
                編集
              </Button>
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
    </Card.Root>
  );
});
