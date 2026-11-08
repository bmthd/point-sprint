import type { PointGroup } from "@workspaces/domain";
import { Box, Card, Flex, Text, VStack } from "@workspaces/ui";
import type { ReactNode } from "react";
import { grouped } from "#/ui/format.ts";
import { PointBreakdown } from "#/routes/-point-breakdown.tsx";

/** How many shops the marathon counts up to. */
const SHOP_STEPS = 10;

/**
 * A plan's result as the top page shows it: the sample's, or the visitor's latest plan, in the same
 * card. `label` sits on the card's edge, `title` and `meta` name the plan, and `action` is beside
 * them. On a phone the legend has the groups' names alone, and the shops are in the total's card.
 */
export function ResultCard({
  label,
  title,
  meta,
  action,
  total,
  capRemaining,
  totals,
  shopCount,
  nextShopRate,
  hidden = false,
}: {
  label: ReactNode;
  title: ReactNode;
  meta: string;
  action?: ReactNode;
  total: number;
  /** Points left under the marathon's cap; `null` when it has none. */
  capRemaining: number | null;
  totals: Record<PointGroup, number>;
  /** Shops bought from; `null` when the plan has no marathon. */
  shopCount: number | null;
  /** What one more shop adds to the rate; `null` when it adds nothing. */
  nextShopRate: number | null;
  /** For the sample, which is not the visitor's. */
  hidden?: boolean;
}) {
  const shops =
    shopCount === null ? null : `${Math.min(shopCount, SHOP_STEPS)} / ${SHOP_STEPS} 店舗`;
  return (
    <Card.Root aria-hidden={hidden || undefined} shadow="lg" overflow="visible" position="relative">
      <Box position="absolute" top="-2.5" left="4">
        {label}
      </Box>
      <Card.Body gap="3" pt="6">
        <Flex w="full" align="center" gap="2">
          <VStack flex="1" minW="0" gap="0" alignItems="stretch">
            <Text fontWeight="bold" truncated>
              {title}
            </Text>
            <Text
              display={{ base: "block", md: "none" }}
              fontSize="xs"
              color="fg.muted"
              fontVariantNumeric="tabular-nums"
            >
              {meta}
            </Text>
          </VStack>
          {action}
        </Flex>
        <Card.Root variant="solid" colorScheme="primary" w="full">
          <Card.Body flexDirection="row" alignItems="flex-end" justifyContent="space-between">
            <VStack gap="1" alignItems="stretch">
              <Text fontSize="sm">獲得予定</Text>
              <Text
                fontSize={{ base: "5xl", md: "4xl" }}
                fontWeight="bold"
                lineHeight="1"
                fontVariantNumeric="tabular-nums"
              >
                {grouped(total)}P
              </Text>
            </VStack>
            <Text fontSize="sm" textAlign="end" fontVariantNumeric="tabular-nums">
              {shops ? (
                <Box as="span" display={{ base: "none", md: "inline" }}>
                  {shops}
                </Box>
              ) : null}
              {capRemaining === null ? null : (
                <>
                  <Box as="span" display={{ base: "inline", md: "none" }}>
                    上限まで
                  </Box>
                  <br />
                  <Text as="span" fontSize="lg" fontWeight="bold" whiteSpace="nowrap">
                    {capRemaining === 0 ? "上限に到達" : `あと ${grouped(capRemaining)}P`}
                  </Text>
                </>
              )}
            </Text>
          </Card.Body>
        </Card.Root>
        <Box display={{ base: "block", md: "none" }} w="full">
          <PointBreakdown totals={totals} />
        </Box>
        <Box display={{ base: "none", md: "block" }} w="full">
          <PointBreakdown totals={totals} legend="names" />
        </Box>
        {shops ? (
          <Flex
            display={{ base: "flex", md: "none" }}
            w="full"
            justify="space-between"
            fontSize="sm"
          >
            <Text fontWeight="bold" fontVariantNumeric="tabular-nums">
              {shops}
            </Text>
            {nextShopRate === null ? null : (
              <Text color="fg.muted">あと 1 店舗で +{nextShopRate}倍</Text>
            )}
          </Flex>
        ) : null}
      </Card.Body>
    </Card.Root>
  );
}
