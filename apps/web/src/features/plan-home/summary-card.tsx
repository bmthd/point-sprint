import { type CalculationResult, type Plan, taxIncludedTarget } from "@workspaces/domain";
import { Box, Button, Card, Progress, Text } from "@workspaces/ui";
import { useId, useState } from "react";
import { ChevronIcon } from "./icons";
import { PointBreakdown } from "./point-breakdown";
import { ShopLadder, currentRow, manYen } from "./shop-ladder";

const DOTS = 10;

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

function ShopDots({ count }: { count: number }) {
  return (
    <Box display="flex" gap="1.5" role="img" aria-label={`買い回り ${DOTS}店舗中${count}店舗`}>
      {Array.from({ length: DOTS }, (_, index) => (
        <Box
          key={index}
          flex="1"
          h="3"
          rounded="full"
          boxSizing="border-box"
          bg={index < count ? "primary.contrast" : index === count ? undefined : "blackAlpha.400"}
          borderWidth={index === count ? "2px" : undefined}
          borderColor="primary.contrast"
        />
      ))}
    </Box>
  );
}

function Gauge({ points, cap }: { points: number; cap: number }) {
  const share = cap === 0 ? 1 : Math.min(1, points / cap);
  return (
    <Box display="flex" flexDirection="column" gap="1.5">
      <Box display="flex" justifyContent="space-between">
        <Label>マラソン上限</Label>
        <Text as="span" fontSize="xs" color="primary.contrast/80" fontVariantNumeric="tabular-nums">
          {num(points)} / {num(cap)}P
        </Text>
      </Box>
      <Progress value={share * 100} colorScheme="mono" aria-hidden />
    </Box>
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
}: {
  plan: Plan;
  result: CalculationResult;
  compact: boolean;
}) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const breakdownId = useId();
  const outlook = result.shopAroundOutlook;
  const amount = countedAmount(plan);
  const remaining = outlook ? currentRow(outlook)?.remainingTaxIncludedApprox : null;

  return (
    <Card.Root as="section" aria-label="サマリー" variant="solid" colorScheme="primary">
      <Card.Body alignItems="stretch">
        <Box display="flex" alignItems="flex-end" justifyContent="space-between">
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
        </Box>

        {outlook ? (
          <Box display="flex" flexDirection="column" gap="2">
            <ShopDots count={Math.min(outlook.shopCount, DOTS)} />
            <Box display="flex" justifyContent="space-between" fontSize="sm">
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
            </Box>
            {outlook.nextShop ? (
              <Text fontSize="sm" bg="blackAlpha.400" rounded="lg" px="2.5" py="2">
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
          </Box>
        ) : null}

        {outlook && (outlook.cap !== null || remaining != null) ? (
          <Box display="flex" flexDirection="column" gap="1.5">
            {outlook.cap !== null ? (
              <Gauge points={result.groupTotals.marathon} cap={outlook.cap} />
            ) : null}
            {remaining != null && remaining < 500 ? (
              <Text fontSize="sm" fontWeight="bold">
                上限に達しました
              </Text>
            ) : remaining != null ? (
              <Text fontSize="sm">
                上限まであと 約
                <Text as="b" fontVariantNumeric="tabular-nums">
                  {manYen(remaining)}
                </Text>{" "}
                買えます
                <Text as="span" color="primary.contrast/80">
                  （税込・概算）
                </Text>
              </Text>
            ) : null}
          </Box>
        ) : null}

        {compact && outlook ? (
          <Box bg="bg.panel" color="fg" rounded="xl" px="3" py="2">
            <ShopLadder outlook={outlook} compact />
          </Box>
        ) : null}

        {compact ? (
          <>
            <Button
              variant="subtle"
              colorScheme="mono"
              size="lg"
              justifyContent="space-between"
              aria-expanded={breakdownOpen}
              aria-controls={breakdownId}
              onClick={() => setBreakdownOpen(!breakdownOpen)}
            >
              ポイントの内訳を見る
              <ChevronIcon open={breakdownOpen} />
            </Button>
            <Box id={breakdownId} hidden={!breakdownOpen}>
              {breakdownOpen ? (
                <Box bg="bg.panel" color="fg" rounded="xl" p="3">
                  <PointBreakdown totals={result.groupTotals} />
                </Box>
              ) : null}
            </Box>
          </>
        ) : (
          <Box
            display="flex"
            justifyContent="space-between"
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
          </Box>
        )}
      </Card.Body>
    </Card.Root>
  );
}
