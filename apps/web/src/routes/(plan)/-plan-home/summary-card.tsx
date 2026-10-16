import {
  type CalculationResult,
  type CapLine,
  type Plan,
  type TaxRate,
  taxIncludedTarget,
} from "@workspaces/domain";
import { Box, Card, Flex, Link, NativeAccordion, Progress, Text } from "@workspaces/ui";
import { useAtomValue } from "jotai";
import { plansAtom } from "../../../state/queries";
import { scopeText, sharedText } from "../-cap-lines";
import { yen } from "../-order-shared";
import { fillPriceOf } from "./cap-list";
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

const num = (value: number) => value.toLocaleString("ja-JP");

const Label = (props: { children: string }) => (
  <Text as="span" fontSize="xs" color="primary.contrast/80" {...props} />
);

/** How far each arrow's tip reaches into the next one, as a percentage of the whole bar. */
const TIP = 2.5;

/** A bar `width`% wide of the whole that ends in a tip. */
const arrowClip = (width: number) => {
  const back = `calc(100% - ${(TIP / width) * 100}%)`;
  return `polygon(0 0, ${back} 0, 100% 50%, ${back} 100%, 0 100%)`;
};

/**
 * The shadow each arrow's tip casts on the next one. A bare URL with its parentheses escaped,
 * because `bgImage` wraps a value in `url()` only when it does not look like a CSS function.
 */
const TIP_SHADOWS = (() => {
  const width = SHOP_STEPS * 24;
  const depth = (TIP / 100) * width;
  const bands = Array.from({ length: SHOP_STEPS - 1 }, (_, index) => {
    const tip = (index + 1) * 24;
    const back = tip - depth;
    return `<polygon points="${back},0 ${tip},6 ${back},12 ${back + 3},12 ${tip + 3},6 ${back + 3},0" fill="url(#s)"/>`;
  });
  return `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 12" preserveAspectRatio="none"><defs><linearGradient id="s"><stop offset="0" stop-opacity="0.45"/><stop offset="1" stop-opacity="0"/></linearGradient></defs>${bands.join("")}</svg>`,
  ).replace(/[()]/g, (paren) => (paren === "(" ? "%28" : "%29"))}`;
})();

/**
 * The shops bought from so far as a row of arrows, each one's tip laid over the next, with the
 * next shop's arrow lit faintly.
 */
function ShopArrows({ count }: { count: number }) {
  const step = 100 / SHOP_STEPS;
  const next = Math.min(count + 1, SHOP_STEPS) * step;
  return (
    <Progress
      aria-label="買い回り"
      aria-valuetext={`${SHOP_STEPS}店舗中${count}店舗`}
      max={SHOP_STEPS}
      value={count}
      size="lg"
      shape="square"
      trackColor="blackAlpha.400"
      rangeColor="primary.contrast"
      clipPath={arrowClip(100)}
      rangeProps={{
        position: "relative",
        clipPath: count === 0 ? undefined : arrowClip(count * step),
      }}
      _before={{
        content: '""',
        position: "absolute",
        top: "0",
        left: "0",
        h: "full",
        w: `${next}%`,
        bg: "primary.contrast/40",
        clipPath: arrowClip(next),
      }}
      _after={{
        content: '""',
        position: "absolute",
        inset: "0",
        bgImage: TIP_SHADOWS,
        bgSize: "100% 100%",
      }}
    />
  );
}

/** The cap the least money fills at `taxRate`; a cap whose rate is 0 now cannot be filled. */
export function nextCap(lines: CapLine[], taxRate: TaxRate) {
  let next: { line: CapLine; price: number } | undefined;
  for (const line of lines) {
    if (line.remaining === 0) continue;
    const price = fillPriceOf(line, taxRate);
    if (price !== null && (next === undefined || price < next.price)) next = { line, price };
  }
  return next;
}

/** 「次に上限に届くのは…」: the cap closest to full, with a link to every cap. */
function NextCap({
  lines,
  today,
  taxRate,
}: {
  lines: CapLine[];
  today: string | undefined;
  taxRate: TaxRate;
}) {
  const plans = useAtomValue(plansAtom);
  if (lines.length === 0) return null;
  const next = nextCap(lines, taxRate);
  if (!next) {
    return lines.every((line) => line.remaining === 0) ? (
      <Text fontSize="sm" fontWeight="bold">
        上限のある特典は、すべて上限に届きました
      </Text>
    ) : null;
  }
  const shared = sharedText(next.line, plans);
  return (
    <Text fontSize="sm" bg="blackAlpha.400" rounded="md" px="2.5" py="2">
      次に上限に届くのは<Text as="b">{next.line.benefit.label}</Text> あと
      <Text as="b" fontVariantNumeric="tabular-nums">
        {yen(next.price)}
      </Text>
      <Text as="span" color="primary.contrast/80">
        （{scopeText(next.line, today)}の枠{shared ? `・${shared}` : ""}）
      </Text>{" "}
      <Link href="#caps" color="inherit" textDecoration="underline">
        すべて見る
      </Link>
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
  today,
  taxRate,
}: {
  plan: Plan;
  result: CalculationResult;
  compact: boolean;
  /** The plan's caps (`useCapLines`). */
  lines: CapLine[];
  today: string | undefined;
  /** The tax rate the caps' fill prices are shown at. */
  taxRate: TaxRate;
}) {
  const outlook = result.shopAroundOutlook;
  const amount = countedAmount(plan);

  return (
    <Card.Root as="section" aria-label="サマリー" variant="solid" colorScheme="primary">
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
              {num(result.total)}
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
            <ShopArrows count={Math.min(outlook.shopCount, SHOP_STEPS)} />
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
                  +{num(outlook.nextShop.pointsGain)}P
                </Text>
                ）
              </Text>
            ) : null}
          </Flex>
        ) : null}

        <NextCap lines={lines} today={today} taxRate={taxRate} />

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
            <span>¥{num(amount)}</span>
          </Flex>
        )}
      </Card.Body>
    </Card.Root>
  );
}
