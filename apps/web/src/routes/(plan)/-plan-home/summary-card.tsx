import {
  type CalculationResult,
  type CapLine,
  type Plan,
  taxIncludedTarget,
} from "@workspaces/domain";
import { Box, Card, Flex, NativeAccordion, Progress, Text } from "@workspaces/ui";
import { grouped } from "../../../ui/format";
import { PointBreakdown } from "./point-breakdown";
import { ShopLadder } from "./shop-ladder";

const SHOP_STEPS = 10;

/** Tax-included target amount of the orders that are not held. */
export function countedAmount(plan: Plan): number {
  return plan.orders
    .filter((order) => !order.onHold)
    .flatMap((order) => order.lineItems)
    .reduce((sum, item) => sum + taxIncludedTarget(item), 0);
}

/** Points per yen of the counted orders, as a percentage to one decimal; "—" with nothing bought. */
export function effectiveRate(total: number, amount: number): string {
  return amount === 0 ? "—" : ((total / amount) * 100).toFixed(1);
}

const Label = (props: { children: string }) => (
  <Text as="span" fontSize="xs" color="primary.contrast/80" {...props} />
);

/**
 * One chevron per shop; the tip of each sits in the notch of the next. A bare URL, because
 * `maskImage` wraps a value that is not a CSS function in `url()`.
 */
const CHEVRONS = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 12" preserveAspectRatio="none"><polygon points="0,0 16,0 22,6 16,12 0,12 6,6"/></svg>',
)}`;

/** The bar's width to its height in the summary column on a wide screen, 328px by 16px. */
const CHEVRONS_RATIO = "41 / 2";

/** The shops bought from so far as a row of chevrons, with the next shop's chevron lit faintly. */
function ShopChevrons({ count }: { count: number }) {
  const step = 100 / SHOP_STEPS;
  const track = "{colors.blackAlpha.400}";
  const next = "color-mix(in srgb, {colors.primary.contrast} 40%, transparent)";
  return (
    <Progress
      aria-label="買い回り"
      aria-valuetext={`${SHOP_STEPS}店舗中${count}店舗`}
      max={SHOP_STEPS}
      value={count}
      size="lg"
      // As wide as the summary column, the bar is 16px tall: kept at that shape on a wider screen, so
      // the chevrons grow instead of stretching.
      h="auto"
      aspectRatio={CHEVRONS_RATIO}
      shape="square"
      rangeColor="primary.contrast"
      bg={`linear-gradient(to right, ${track} ${count * step}%, ${next} ${count * step}% ${(count + 1) * step}%, ${track} ${(count + 1) * step}%)`}
      maskImage={CHEVRONS}
      maskSize={`${step}% 100%`}
      maskRepeat="repeat-x"
    />
  );
}

/** 「上限のある特典は、すべて上限に届きました」, once every cap of the plan is filled. */
function AllCapsFilled({ lines }: { lines: CapLine[] }) {
  if (lines.length === 0 || lines.some((line) => line.remaining > 0)) return null;
  return (
    <Text fontSize="sm" fontWeight="bold">
      上限のある特典は、すべて上限に届きました
    </Text>
  );
}

/**
 * The red summary of the plan. On a phone (`compact`) it also holds the shop ladder's current row
 * and the point breakdown behind a toggle; on a wide screen those are cards of their own and the
 * card ends with the total amount instead.
 */
export function SummaryCard({
  plan,
  result,
  compact,
  lines,
}: {
  plan: Plan;
  result: CalculationResult;
  compact: boolean;
  /** The plan's caps (`useCapLines`). */
  lines: CapLine[];
}) {
  const outlook = result.shopAroundOutlook;
  const amount = countedAmount(plan);

  return (
    <Card.Root
      as="section"
      aria-label="サマリー"
      variant="solid"
      colorScheme="primary"
      rounded="l4"
    >
      <Card.Body alignItems="stretch">
        <Flex align="flex-end" justify="space-between">
          <Box>
            <Label>獲得予定</Label>
            <Text
              fontSize="40px"
              fontWeight="bold"
              lineHeight="1.1"
              fontVariantNumeric="tabular-nums"
            >
              {grouped(result.total)}
              <Text as="span" fontSize="lg" fontWeight="medium" ms="1">
                P
              </Text>
            </Text>
          </Box>
          <Box textAlign="end">
            <Label>実質還元率</Label>
            <Text fontSize="2xl" fontWeight="bold" fontVariantNumeric="tabular-nums">
              {effectiveRate(result.total, amount)}
              <Text as="span" fontSize="sm">
                %
              </Text>
            </Text>
          </Box>
        </Flex>

        {outlook ? (
          <Flex direction="column" gap="2">
            <ShopChevrons count={Math.min(outlook.shopCount, SHOP_STEPS)} />
            <Flex justify="space-between" fontSize="sm">
              <span>
                <Text as="b" fontVariantNumeric="tabular-nums">
                  {outlook.shopCount}
                </Text>
                店舗を買い回り中
              </span>
              <span>
                マラソン{" "}
                <Text as="b" fontVariantNumeric="tabular-nums">
                  +{outlook.currentRate}倍
                </Text>
              </span>
            </Flex>
            {outlook.nextShop ? (
              <Text fontSize="sm" bg="blackAlpha.400" rounded="md" px="2.5" py="2">
                あと1店舗で全商品{" "}
                <Text as="b" fontVariantNumeric="tabular-nums">
                  +{outlook.nextShop.rateDelta}倍
                </Text>
                （約{" "}
                <Text as="b" fontVariantNumeric="tabular-nums">
                  +{grouped(outlook.nextShop.pointsGain)}P
                </Text>
                ）
              </Text>
            ) : null}
          </Flex>
        ) : null}

        <AllCapsFilled lines={lines} />

        {compact && outlook ? (
          <Box bg="bg.panel" color="fg" rounded="md" px="3" py="2">
            <ShopLadder outlook={outlook} compact />
          </Box>
        ) : null}

        {compact ? (
          <Box bg="bg.panel" color="fg" rounded="md" px="3" py="2">
            <NativeAccordion.Root>
              <NativeAccordion.Item borderWidth="0">
                <NativeAccordion.Button fontSize="sm" fontWeight="bold">
                  ポイントの内訳を見る
                </NativeAccordion.Button>
                <NativeAccordion.Panel px="0">
                  <PointBreakdown totals={result.groupTotals} />
                </NativeAccordion.Panel>
              </NativeAccordion.Item>
            </NativeAccordion.Root>
          </Box>
        ) : (
          <Flex
            justify="space-between"
            borderTopWidth="1px"
            borderColor="blackAlpha.400"
            pt="2.5"
            fontSize="sm"
            fontVariantNumeric="tabular-nums"
          >
            <Text as="span" color="primary.contrast/80">
              合計金額
            </Text>
            <span>¥{grouped(amount)}</span>
          </Flex>
        )}
      </Card.Body>
    </Card.Root>
  );
}
