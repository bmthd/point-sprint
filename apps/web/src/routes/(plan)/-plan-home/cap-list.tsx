import { selectAtom } from "jotai/utils";
import { plansAtom } from "#/state/query-atoms.ts";
import {
  type CapLine,
  type CapRow as Row,
  type Period,
  type TaxRate,
  capRows,
  type Plan,
  deepEqual,
} from "@workspaces/domain";
import {
  Badge,
  Box,
  Flex,
  Heading,
  List,
  NativeTable,
  SegmentedControl,
  Tag,
  Text,
} from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { grouped, yen } from "#/ui/format.ts";

import { CAP_TAX_RATES, conditionText, scopeText } from "#/routes/(plan)/-cap-lines.ts";
import { segmentPressArea, taxRateLabel } from "#/routes/(plan)/-order-shared.tsx";

/** Only the shared names subscribe to plans; changes to other fields leave the note alone. */
function SharedPlans({ ids, table = false }: { ids: string[]; table?: boolean }) {
  const names = useAtomValue(selectAtom(plansAtom, namesOfPlans(ids), deepEqual));
  if (names.length === 0) return null;
  const shared = `${names.join("・")}と共有`;
  return table ? (
    <Text display="block" fontSize="xs" color="fg.muted">
      {shared}
    </Text>
  ) : (
    <Text as="span" fontSize="xs" color="fg.muted">
      {shared}
    </Text>
  );
}

/**
 * How full the cap is, in two colors: what other plans used, then what this plan used.
 * `Progress` has one value, so the two parts are boxes of their own.
 */
function CapGauge({ line }: { line: CapLine }) {
  const width = (points: number) =>
    `${line.cap === 0 ? 0 : Math.min(100, (points / line.cap) * 100)}%`;
  return (
    <Flex
      role="img"
      aria-label={`ほかのプラン ${grouped(line.usedElsewhere)}P・このプラン ${grouped(line.usedHere)}P・上限 ${grouped(line.cap)}P`}
      h="2"
      rounded="full"
      overflow="hidden"
      bg="bg.muted"
    >
      <Box w={width(line.usedElsewhere)} bg="gray.solid" />
      <Box w={width(line.usedHere)} bg="primary.solid" />
    </Flex>
  );
}

/** One row of caps that the same price fills alike: their names, and one gauge for them all. */
function CapRow({ row, today, period }: { row: Row; today: string | undefined; period: Period }) {
  const [line] = row.lines;
  if (!line) return null;
  const condition = conditionText(line, period);
  return (
    <List.Item display="flex" flexDirection="column" gap="1.5" py="2">
      <Flex align="center" gap="2" wrap="wrap">
        <Text as="span" fontSize="sm" fontWeight="bold">
          {row.lines.map((each) => each.benefit.label).join("・")}
        </Text>
        <Badge variant="outline" colorScheme="gray" fullRounded>
          {scopeText(line, today)}
        </Badge>
        <SharedPlans ids={line.sharedWith} />
      </Flex>
      <CapGauge line={line} />
      <Flex justify="space-between" align="flex-end" gap="2" fontSize="sm">
        <Text as="span" color="fg.muted" fontVariantNumeric="tabular-nums">
          {capsText(row, line)}
        </Text>
        <Flex direction="column" align="flex-end">
          {condition ? (
            <Text as="span" fontSize="xs" color="fg.muted">
              {condition}
            </Text>
          ) : null}
          <Text as="b" fontVariantNumeric="tabular-nums">
            {row.price === null ? priceText(row) : `あと${priceText(row)}`}
          </Text>
        </Flex>
      </Flex>
    </List.Item>
  );
}

const capsText = (row: Row, line: CapLine) =>
  `${grouped(line.usedElsewhere + line.usedHere)} / ${grouped(line.cap)}P${row.lines.length > 1 ? "（それぞれ）" : ""}`;

/** The price that fills a cap not filled yet; none when nothing fills it. */
const priceText = (row: Row) => (row.price === null ? "—" : yen(row.price));

/** The caps not filled yet as a table, one row a line, on a wide screen. */
function CapTable({
  rows,
  today,
  period,
}: {
  rows: Row[];
  today: string | undefined;
  period: Period;
}) {
  return (
    <NativeTable.Root fontSize="sm" fontVariantNumeric="tabular-nums">
      <NativeTable.Thead fontSize="xs" color="fg.muted">
        <NativeTable.Tr>
          <NativeTable.Th fontWeight="normal" textAlign="start" px="2" pt="0" pb="1">
            特典
          </NativeTable.Th>
          <NativeTable.Th fontWeight="normal" textAlign="start" px="2" pt="0" pb="1">
            対象
          </NativeTable.Th>
          <NativeTable.Th fontWeight="normal" textAlign="start" px="2" pt="0" pb="1">
            使った分 / 上限
          </NativeTable.Th>
          <NativeTable.Th
            fontWeight="normal"
            textAlign="end"
            px="2"
            pt="0"
            pb="1"
            whiteSpace="nowrap"
          >
            あと（税込）
          </NativeTable.Th>
        </NativeTable.Tr>
      </NativeTable.Thead>
      <NativeTable.Tbody>
        {rows.map((row) => {
          const [line] = row.lines;
          if (!line) return null;
          const condition = conditionText(line, period);
          return (
            <NativeTable.Tr
              key={row.lines.map((each) => `${each.benefit.id}:${each.key}`).join(",")}
            >
              <NativeTable.Td px="2" py="2.5" verticalAlign="middle">
                <Text as="span" fontWeight="bold">
                  {row.lines.map((each) => each.benefit.label).join("・")}
                </Text>
                {condition ? (
                  <Text display="block" fontSize="xs" color="fg.muted">
                    {condition}
                  </Text>
                ) : null}
                <SharedPlans ids={line.sharedWith} table />
              </NativeTable.Td>
              <NativeTable.Td px="2" py="2.5" verticalAlign="middle">
                <Badge variant="outline" colorScheme="gray" fullRounded>
                  {scopeText(line, today)}
                </Badge>
              </NativeTable.Td>
              <NativeTable.Td px="2" py="2.5" verticalAlign="middle" w="32%">
                <CapGauge line={line} />
                <Text display="block" mt="1" fontSize="xs" color="fg.muted">
                  {capsText(row, line)}
                </Text>
              </NativeTable.Td>
              <NativeTable.Td
                px="2"
                py="2.5"
                verticalAlign="middle"
                textAlign="end"
                fontWeight="bold"
                whiteSpace="nowrap"
              >
                {priceText(row)}
              </NativeTable.Td>
            </NativeTable.Tr>
          );
        })}
      </NativeTable.Tbody>
    </NativeTable.Root>
  );
}

/** The filled caps: just their names and caps, as there is nothing left of them. */
function FilledTags({ rows }: { rows: Row[] }) {
  return (
    <List.Root display="flex" flexDirection="row" flexWrap="wrap" gap="1.5">
      {rows.flatMap((row) =>
        row.lines.map((line) => (
          <List.Item key={`${line.benefit.id}:${line.key}`}>
            <Tag size="sm" variant="subtle" colorScheme="gray">
              {line.benefit.label}
              <Text as="span" ms="1" color="fg.muted" fontVariantNumeric="tabular-nums">
                {grouped(line.cap)}P
              </Text>
            </Tag>
          </List.Item>
        )),
      )}
    </List.Root>
  );
}

/**
 * 「上限までの残り」: every cap of the plan, in the order the tax-included price that fills it
 * exactly reaches it. Caps one price fills alike are one row, a table on a wide screen (`table`),
 * and the filled caps come last, only their names.
 */
export function CapList({
  lines,
  today,
  period,
  taxRate,
  onTaxRate,
  table = false,
}: {
  lines: CapLine[];
  today: string | undefined;
  period: Period;
  taxRate: TaxRate;
  onTaxRate: (taxRate: TaxRate) => void;
  table?: boolean;
}) {
  const rows = capRows(lines, taxRate);
  const open = rows.filter((row) => row.price !== 0);
  const filled = rows.filter((row) => row.price === 0);
  return (
    <Flex direction="column" gap="2">
      <Flex justify="space-between" align="center" gap="2" wrap="wrap">
        <Heading as="h3" fontSize="sm">
          上限までの残り
        </Heading>
        <SegmentedControl.Root
          size="sm"
          minW="0"
          aria-label="買う商品の税率"
          items={CAP_TAX_RATES.map((rate) => ({ label: taxRateLabel(rate), value: String(rate) }))}
          value={String(taxRate)}
          onChange={(value) => onTaxRate(Number(value) as TaxRate)}
          css={segmentPressArea}
        />
      </Flex>
      {open.length === 0 ? null : table ? (
        <CapTable rows={open} today={today} period={period} />
      ) : (
        <List.Root gap="0">
          {open.map((row) => (
            <CapRow
              key={row.lines.map((line) => `${line.benefit.id}:${line.key}`).join(",")}
              row={row}
              today={today}
              period={period}
            />
          ))}
        </List.Root>
      )}
      {filled.length > 0 ? (
        <>
          <Heading as="h4" fontSize="xs" color="fg.muted" pt="2">
            上限に届いた特典（{filled.reduce((sum, row) => sum + row.lines.length, 0)}）
          </Heading>
          <FilledTags rows={filled} />
        </>
      ) : null}
      <Text fontSize="xs" color="fg.muted">
        選んだ税率の商品を1つ買って、上限をちょうど使い切る税込の金額です。マラソンはいまの店舗数の倍率で計算しています。
      </Text>
    </Flex>
  );
}

const namesOfPlans = (ids: string[]) => (plans: Plan[]) =>
  ids.flatMap((id) => plans.find((plan) => plan.id === id)?.name ?? []);
