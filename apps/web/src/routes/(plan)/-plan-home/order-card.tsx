import { taxExcludedTarget, taxIncludedTarget } from "@workspaces/domain";
import {
  Box,
  Collapse,
  dataAttr,
  Flex,
  Button,
  IconButton,
  List,
  Switch,
  Text,
  VisuallyHidden,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@workspaces/ui";
import { useAtomValue, useSetAtom } from "jotai";
import { createContext, memo, use, useId, useMemo, useRef } from "react";
import { pointsText, rateText, yen } from "#/ui/format.ts";
import { orderAtom } from "#/state/derived.ts";
import { copyOrderAtom, moveOrderAtom, toggleHoldAtom } from "#/state/plan-operations.ts";
import { openOrderIdAtom, reorderModeAtom } from "#/routes/(plan)/-ui.ts";
import { monthDayWithWeekday } from "#/ui/dates.ts";
import { ExpandChevronIcon } from "#/routes/(plan)/-expand-chevron-icon.tsx";
import {
  CampaignChip,
  OrderBadge,
  isOpenAtom,
  orderCardPointsAtom,
  orderTitle,
  taxLabel,
  useSaveOrderChange,
  useShopName,
} from "#/routes/(plan)/-order-shared.tsx";
import { pointFill } from "#/routes/-point-breakdown.tsx";

/** The id of the text that explains what turning 購入決定 off does, for each row's switch. */
export const HoldHintContext = createContext<string | undefined>(undefined);

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

/**
 * One order on the phone's order list: a row of the list's table, like a row of the desktop table,
 * with its 購入決定 switch. Only one row is open at a time.
 */
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
  const shopName = useShopName(order);
  const bodyId = useId();
  const holdHintId = use(HoldHintContext);
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
  const title = orderTitle(order);

  return (
    <List.Item>
      {/* A held order is told apart by its sunken row, as well as its 「保留」 badge. */}
      <Box data-held={dataAttr(held)} css={{ "&[data-held]": { bg: "bg.subtle" } }}>
        <Flex align="center" position="relative">
          {/* Laid over the row's button, so a press on the row ripples across the switch's column too. */}
          <Switch
            size="sm"
            colorScheme="primary"
            boxSize="11"
            justifyContent="center"
            position="absolute"
            insetStart="1"
            top="50%"
            transform="translateY(-50%)"
            zIndex="1"
            checked={!held}
            inputProps={{
              "aria-label": `${shopName}の注文を購入決定`,
              "aria-describedby": holdHintId,
            }}
            onChange={() => save(toggleHold({ planId, orderId }))}
          />
          <Button
            variant="ghost"
            colorScheme="gray"
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpenOrderId(open ? null : orderId)}
            flex="1"
            minW="0"
            gap="2"
            // Room on the left for the switch laid over it: 4px, its 44px, and 4px.
            ps="13"
            pe="3"
            // Square, as wide and as tall as the row it fills.
            rounded="0"
            // The header holds three lines of text; a button is one line tall and does not wrap.
            h="auto"
            py="3"
            whiteSpace="normal"
            textAlign="start"
            lineHeight="normal"
          >
            {/* As wide as 「保留」, so the text beside it stays put when the order is held. */}
            <Flex as="span" flex="none" w="9" justify="center">
              <OrderBadge badge={props.badge} />
            </Flex>
            <Flex as="span" flex="1" minW="0" direction="column" gap="0.5">
              <Flex as="span" gap="1.5" fontSize="xs" color="fg.muted">
                <Text as="span" lineClamp={1}>
                  {shopName}
                </Text>
                <Text as="span" flex="none" fontVariantNumeric="tabular-nums">
                  {monthDayWithWeekday(order.date)}
                </Text>
              </Flex>
              {/* Without an item name the line still shows, so every card is as tall as the others. */}
              {title ? (
                <Text as="span" fontSize="sm" fontWeight="medium" lineClamp={1}>
                  {title}
                </Text>
              ) : (
                <Text as="span" fontSize="sm" color="fg.muted">
                  {shopName === "ショップ未入力"
                    ? `${monthDayWithWeekday(order.date)}の注文`
                    : "商品名なし"}
                </Text>
              )}
              {/* One chip high with or without campaigns, so every row is as tall. */}
              <Flex
                as="span"
                align="center"
                wrap="wrap"
                gap="1.5"
                minH="5.5"
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
              </Flex>
            </Flex>
            <Flex
              as="span"
              direction="column"
              align="flex-end"
              gap="0.5"
              fontVariantNumeric="tabular-nums"
            >
              {/* Held or not, two lines, and the rate and 保留中 share one cell, like a row. */}
              {held ? (
                <Text as="s" fontSize="md" fontWeight="bold" color="fg.muted">
                  <VisuallyHidden>保留中の見込み </VisuallyHidden>
                  {pointsText(points.total)}
                </Text>
              ) : (
                <Text as="span" fontSize="md" fontWeight="bold">
                  {pointsText(points.total)}
                </Text>
              )}
              <Box as="span" display="grid" justifyItems="end" fontSize="2xs" color="fg.muted">
                <Text
                  as="span"
                  gridArea="1 / 1"
                  css={{ "[data-held] &": { visibility: "hidden" } }}
                >
                  {rateText(points.rate, false)}
                </Text>
                <Text
                  as="span"
                  gridArea="1 / 1"
                  visibility="hidden"
                  css={{ "[data-held] &": { visibility: "visible" } }}
                  aria-hidden
                >
                  保留中
                </Text>
              </Box>
            </Flex>
            <Flex as="span" color="fg.muted">
              <ExpandChevronIcon open={open} />
            </Flex>
          </Button>
          {reordering ? (
            <Flex flex="none" pr="1">
              <IconButton
                ref={upRef}
                variant="ghost"
                size="lg"
                colorScheme="gray"
                aria-label={`${shopName}を上へ`}
                disabled={index === 0}
                onClick={() => move(index - 1)}
              >
                <ArrowUpIcon boxSize="5" />
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
                <ArrowDownIcon boxSize="5" />
              </IconButton>
            </Flex>
          ) : null}
        </Flex>
        {/* It slides open and shut, like a row of the desktop table. */}
        <Collapse open={open} unmountOnExit id={bodyId}>
          <Flex direction="column" gap="2.5" borderTopWidth="1px" borderColor="border" p="3">
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
            <Flex justify="space-between" fontSize="xs" color="fg.muted">
              <span>税抜の基準額</span>
              <Text as="span" fontVariantNumeric="tabular-nums">
                {yen(base)}
              </Text>
            </Flex>
            {/* A held order's lines are the ones it would have once counted, faded and struck. */}
            <List.Root
              gap="1.5"
              fontSize="sm"
              css={{ "[data-held] &": { color: "fg.muted" } }}
              aria-label={held ? "購入決定にしたときの内訳" : "ポイントの内訳"}
            >
              {points.rows.map((row) => (
                <List.Item
                  key={row.key}
                  display="grid"
                  gridTemplateColumns="14px 1fr 56px 56px"
                  alignItems="center"
                  gap="2"
                >
                  <Box
                    boxSize="2.5"
                    rounded="xs"
                    bg={pointFill(row.group, 2)}
                    css={{ "[data-held] &": { opacity: 0.4 } }}
                    aria-hidden
                  />
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
                    as={held ? "s" : "span"}
                    textAlign="end"
                    fontWeight="medium"
                    fontVariantNumeric="tabular-nums"
                  >
                    {pointsText(row.points)}
                  </Text>
                </List.Item>
              ))}
            </List.Root>
            <Box display="grid" gridTemplateColumns="repeat(3, minmax(0, 1fr))" gap="2">
              <Button variant="outline" size="lg" onClick={() => props.onEdit(orderId)}>
                編集
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => save(copyOrder({ planId, orderId }))}
              >
                複製
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
          </Flex>
        </Collapse>
      </Box>
    </List.Item>
  );
});
