import { type CapLine, type Plan, type TaxRate, priceToFill } from "@workspaces/domain";
import { Badge, Box, ButtonGroup, Flex, Heading, List, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { plansAtom } from "../../../state/queries";
import { CAP_TAX_RATES, scopeText, sharedText } from "../-cap-lines";
import { taxRateLabel, yen } from "../-order-shared";

const num = (value: number) => value.toLocaleString("ja-JP");

/** The price that fills the line's cap at `taxRate`; `null` while the rate is 0. */
export const fillPriceOf = (line: CapLine, taxRate: TaxRate) =>
  priceToFill(line.remaining, taxRate, line.rate, line.benefit.amountBasis);

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
      aria-label={`ほかのプラン ${num(line.usedElsewhere)}P・このプラン ${num(line.usedHere)}P・上限 ${num(line.cap)}P`}
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

function CapRow({
  line,
  today,
  taxRate,
  plans,
}: {
  line: CapLine;
  today: string | undefined;
  taxRate: TaxRate;
  plans: Plan[];
}) {
  const price = fillPriceOf(line, taxRate);
  const shared = sharedText(line, plans);
  return (
    <List.Item display="flex" flexDirection="column" gap="1.5" py="2">
      <Flex align="center" gap="2" wrap="wrap">
        <Text as="span" fontSize="sm" fontWeight="bold">
          {line.benefit.label}
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
      <Flex justify="space-between" fontSize="sm" fontVariantNumeric="tabular-nums">
        <Text as="span" color="fg.muted">
          {num(line.usedElsewhere + line.usedHere)} / {num(line.cap)}P
        </Text>
        <Text as="b">
          {line.remaining === 0 ? "上限" : price === null ? "—" : `あと${yen(price)}`}
        </Text>
      </Flex>
    </List.Item>
  );
}

/** 「上限までの残り」: every cap of the plan, and the tax-included price that fills it exactly. */
export function CapList({
  lines,
  today,
  taxRate,
  onTaxRate,
}: {
  lines: CapLine[];
  today: string | undefined;
  taxRate: TaxRate;
  onTaxRate: (taxRate: TaxRate) => void;
}) {
  const plans = useAtomValue(plansAtom);
  return (
    <Flex direction="column" gap="2">
      <Flex justify="space-between" align="center" gap="2" wrap="wrap">
        <Heading as="h3" fontSize="sm">
          上限までの残り
        </Heading>
        <ButtonGroup.Root attached size="sm" aria-label="買う商品の税率">
          {CAP_TAX_RATES.map((rate) => {
            const selected = rate === taxRate;
            return (
              <ButtonGroup.Item
                key={rate}
                type="button"
                aria-pressed={selected}
                onClick={() => onTaxRate(rate)}
                variant={selected ? "solid" : "outline"}
                colorScheme={selected ? "primary" : undefined}
              >
                {taxRateLabel(rate)}
              </ButtonGroup.Item>
            );
          })}
        </ButtonGroup.Root>
      </Flex>
      <List.Root gap="0">
        {lines.map((line) => (
          <CapRow
            key={`${line.benefit.id}:${line.key}`}
            line={line}
            today={today}
            taxRate={taxRate}
            plans={plans}
          />
        ))}
      </List.Root>
      <Text fontSize="xs" color="fg.muted">
        選んだ税率の商品を1つ買って、上限をちょうど使い切る税込の金額です。マラソンはいまの店舗数の倍率で計算しています。
      </Text>
    </Flex>
  );
}
