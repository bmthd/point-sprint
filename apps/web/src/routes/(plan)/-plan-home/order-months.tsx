import { type Order, type Plan, spuIdsIn } from "@workspaces/domain";
import { Box, Button, Flex, List, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { accountIdOf } from "../../../state/accounts";
import { accountSettingsAtom } from "../../../state/derived";
import { spuMonthsAtom } from "../../../state/queries";
import { ForwardIcon } from "../../../ui/icons";
import { monthText } from "../-warnings";
import { num, spuMonthRate } from "../-spu-month/spu-month-editor";

const monthOf = (order: Order) => order.date.slice(0, 7);

/** 「11月の注文 ──── 11月の SPU 7.3倍 ›」: the orders after it are calculated with that month's SPU. */
function MonthSeparator({
  plan,
  month,
  onSpu,
  ...props
}: {
  plan: Plan;
  month: string;
  onSpu: (month: string) => void;
} & Parameters<typeof List.Item>[0]) {
  const settings = useAtomValue(accountSettingsAtom);
  const stored = useAtomValue(spuMonthsAtom);
  const rate = spuMonthRate(spuIdsIn(stored, accountIdOf(plan, settings), month));
  return (
    <List.Item display="flex" alignItems="center" gap="2" fontSize="sm" {...props}>
      <Text as="span" fontWeight="bold" whiteSpace="nowrap">
        {monthText(month)}の注文
      </Text>
      <Box flex="1" h="1px" bg="border.emphasized" opacity="0.5" aria-hidden />
      <Button
        variant="ghost"
        colorScheme="primary"
        color="link"
        size="sm"
        px="1"
        endIcon={<ForwardIcon />}
        onClick={() => onSpu(month)}
      >
        <Flex as="span" fontVariantNumeric="tabular-nums">
          {monthText(month)}の SPU {num(rate)}倍
        </Flex>
      </Button>
    </List.Item>
  );
}

/**
 * The orders' items in list order, with a month's separator before an order of another month than
 * the one before it. Only when the orders are of more than one month.
 */
export function withMonthSeparators({
  plan,
  onSpu,
  items,
  separator = {},
}: {
  plan: Plan;
  onSpu: ((month: string) => void) | undefined;
  /** One item per order of `plan.orders`, in the same order. */
  items: ReactNode[];
  /** Props of each separator's list item, for the list it is in. */
  separator?: Parameters<typeof List.Item>[0];
}): ReactNode[] {
  const months = plan.orders.map(monthOf);
  if (!onSpu || new Set(months).size < 2) return items;
  return items.flatMap((item, index) => {
    const month = months[index];
    if (month === undefined || month === months[index - 1]) return [item];
    return [
      <MonthSeparator
        key={`month-${month}-${index}`}
        plan={plan}
        month={month}
        onSpu={onSpu}
        {...separator}
      />,
      item,
    ];
  });
}
