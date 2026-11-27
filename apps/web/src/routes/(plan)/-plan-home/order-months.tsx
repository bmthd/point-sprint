import { type Order, spuIdsIn, accountIdOf } from "@workspaces/domain";
import { Box, Button, Flex, List, Text, ChevronRightIcon } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { rounded } from "#/ui/format.ts";

import { accountSettingsAtom, planAtom } from "#/state/derived.ts";
import { spuMonthsAtom } from "#/state/query-atoms.ts";
import { monthText } from "#/routes/(plan)/-warnings.tsx";
import { spuMonthRate } from "#/routes/(plan)/-spu-month/spu-month-editor.tsx";

const monthOf = (order: Pick<Order, "date">) => order.date.slice(0, 7);

/** 「11月の注文 ──── 11月の SPU 7.3倍 ›」: the orders after it are calculated with that month's SPU. */
function MonthSeparator({
  planId,
  month,
  onSpu,
  ...props
}: {
  planId: string;
  month: string;
  onSpu: (month: string) => void;
} & Parameters<typeof List.Item>[0]) {
  const plan = useAtomValue(planAtom(planId));
  const settings = useAtomValue(accountSettingsAtom);
  const stored = useAtomValue(spuMonthsAtom);
  if (!plan) return null;
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
        endIcon={<ChevronRightIcon />}
        onClick={() => onSpu(month)}
      >
        <Flex as="span" fontVariantNumeric="tabular-nums">
          {monthText(month)}の SPU {rounded(rate)}倍
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
  planId,
  orders,
  onSpu,
  items,
  separator = {},
}: {
  planId: string;
  orders: readonly Pick<Order, "date">[];
  onSpu: ((month: string) => void) | undefined;
  /** One item per order of `orders`, in the same order. */
  items: ReactNode[];
  /** Props of each separator's list item, for the list it is in. */
  separator?: Parameters<typeof List.Item>[0];
}): ReactNode[] {
  const months = orders.map(monthOf);
  if (!onSpu || new Set(months).size < 2) return items;
  return items.flatMap((item, index) => {
    const month = months[index];
    if (month === undefined || month === months[index - 1]) return [item];
    return [
      <MonthSeparator
        key={`month-${month}-${index}`}
        planId={planId}
        month={month}
        onSpu={onSpu}
        {...separator}
      />,
      item,
    ];
  });
}
