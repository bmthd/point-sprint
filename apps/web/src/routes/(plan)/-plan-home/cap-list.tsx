import {
  type CapLine,
  type CapRow as Row,
  type Period,
  type Plan,
  type TaxRate,
  capRows,
} from "@workspaces/domain";
import { Badge, Box, Flex, Heading, List, SegmentedControl, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { grouped, yen } from "../../../ui/format";
import { plansAtom } from "../../../state/queries";
import { CAP_TAX_RATES, conditionText, scopeText, sharedText } from "../-cap-lines";
import { taxRateLabel, taxRateSegmentsStyle } from "../-order-shared";

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
function CapRow({
  row,
  today,
  period,
  plans,
}: {
  row: Row;
  today: string | undefined;
  period: Period;
  plans: Plan[];
}) {
  const [line] = row.lines;
  if (!line) return null;
  const shared = sharedText(line, plans);
  const condition = row.price === 0 ? undefined : conditionText(line, period);
  return (
    <List.Item display="flex" flexDirection="column" gap="1.5" py="2">
      <Flex align="center" gap="2" wrap="wrap">
        <Text as="span" fontSize="sm" fontWeight="bold">
          {row.lines.map((each) => each.benefit.label).join("・")}
        </Text>
        <Badge variant="outline" colorScheme="gray" fullRounded>
          {scopeText(line, today)}
        </Badge>
        {shared ? (
          <Text as="span" fontSize="xs" color="fg.muted">
            {shared}
          </Text>
        ) : null}
      </Flex>
      <CapGauge line={line} />
      <Flex justify="space-between" align="flex-end" gap="2" fontSize="sm">
        <Text as="span" color="fg.muted" fontVariantNumeric="tabular-nums">
          {grouped(line.usedElsewhere + line.usedHere)} / {grouped(line.cap)}P
          {row.lines.length > 1 ? "（それぞれ）" : ""}
        </Text>
        <Flex direction="column" align="flex-end">
          {condition ? (
            <Text as="span" fontSize="xs" color="fg.muted">
              {condition}
            </Text>
          ) : null}
          <Text as="b" fontVariantNumeric="tabular-nums">
            {row.price === 0 ? "上限" : row.price === null ? "—" : `あと${yen(row.price)}`}
          </Text>
        </Flex>
      </Flex>
    </List.Item>
  );
}

/**
 * 「上限までの残り」: every cap of the plan, in the order the tax-included price that fills it
 * exactly reaches it. Caps one price fills alike are one row, and the filled caps come last.
 */
export function CapList({
  lines,
  today,
  period,
  taxRate,
  onTaxRate,
}: {
  lines: CapLine[];
  today: string | undefined;
  period: Period;
  taxRate: TaxRate;
  onTaxRate: (taxRate: TaxRate) => void;
}) {
  const plans = useAtomValue(plansAtom);
  const rows = capRows(lines, taxRate);
  const open = rows.filter((row) => row.price !== 0);
  const filled = rows.filter((row) => row.price === 0);
  const list = (shown: Row[]) => (
    <List.Root gap="0">
      {shown.map((row) => (
        <CapRow
          key={row.lines.map((line) => `${line.benefit.id}:${line.key}`).join(",")}
          row={row}
          today={today}
          period={period}
          plans={plans}
        />
      ))}
    </List.Root>
  );
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
          {...taxRateSegmentsStyle}
        />
      </Flex>
      {open.length > 0 ? list(open) : null}
      {filled.length > 0 ? (
        <>
          <Heading as="h4" fontSize="xs" color="fg.muted" pt="2">
            上限に届いた特典
          </Heading>
          {list(filled)}
        </>
      ) : null}
      <Text fontSize="xs" color="fg.muted">
        選んだ税率の商品を1つ買って、上限をちょうど使い切る税込の金額です。マラソンはいまの店舗数の倍率で計算しています。
      </Text>
    </Flex>
  );
}
