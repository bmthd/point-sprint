import { Badge, Box, Collapse, Flex, SparklesIcon, Text } from "@workspaces/ui";
import type { ReactNode } from "react";
import { grouped } from "#/ui/format.ts";
import { RouterLink } from "#/ui/router-link.tsx";

/** The label of a gain of 1,000P or more from one more shop. */
const LABEL = "1店舗で +1,000P 超え";

/** A light sweep across the gold, once, when it appears. */
const shine = {
  content: '""',
  position: "absolute",
  inset: "0",
  pointerEvents: "none",
  bgImage: "linear-gradient(105deg, transparent 35%, {colors.whiteAlpha.700} 50%, transparent 65%)",
  translate: "-110% 0",
  animationDuration: "0.8s",
  animationDelay: "0.25s",
  animationFillMode: "both",
  animationTimingFunction: "ease-out",
  _keyframes: { from: { translate: "-110% 0" }, to: { translate: "110% 0" } },
  "@media (prefers-reduced-motion: reduce)": { display: "none" },
} as const;

function Gold({ children }: { children: ReactNode }) {
  return (
    <Box position="relative" overflow="hidden" bg="amber.300" color="black" _after={shine}>
      {children}
    </Box>
  );
}

/**
 * 「あと1店舗で全商品 +N倍（約 +NP）」 under the shop chevrons. While one more shop of a
 * 1000円ポッキリ adds 1,000P or more (`gain`), the row turns gold, says so and links the guide.
 */
export function NextShopRow({
  rateDelta,
  pointsGain,
  gain,
}: {
  rateDelta: number;
  pointsGain: number;
  gain: number | null;
}) {
  return (
    <Box>
      <Collapse open={gain === null} unmountOnExit>
        <Text fontSize="sm" bg="blackAlpha.400" rounded="md" px="2.5" py="2">
          あと1店舗で全商品{" "}
          <Text as="b" fontVariantNumeric="tabular-nums">
            +{rateDelta}倍
          </Text>
          （約{" "}
          <Text as="b" fontVariantNumeric="tabular-nums">
            +{grouped(pointsGain)}P
          </Text>
          ）
        </Text>
      </Collapse>
      <Collapse open={gain !== null} unmountOnExit>
        <Box rounded="lg" overflow="hidden">
          <Gold>
            <Flex role="status" direction="column" alignItems="start" gap="1" px="3" py="2.5">
              <Badge fullRounded bg="black" color="amber.300" gap="1" fontWeight="bold">
                <SparklesIcon />
                {LABEL}
              </Badge>
              <Text fontSize="sm">
                あと1店舗で全商品{" "}
                <Text as="b" fontVariantNumeric="tabular-nums">
                  +{rateDelta}倍
                </Text>
                <Text as="span" whiteSpace="nowrap">
                  （
                  <RouterLink
                    to="/guides/$slug"
                    params={{ slug: "1000yen-items" }}
                    color="inherit"
                    textDecoration="underline"
                  >
                    1000円ポッキリ
                  </RouterLink>
                  で約{" "}
                  <Text as="b" fontSize="xl" lineHeight="1.2" fontVariantNumeric="tabular-nums">
                    +{grouped(gain ?? 0)}P
                  </Text>
                  ）
                </Text>
              </Text>
            </Flex>
          </Gold>
        </Box>
      </Collapse>
    </Box>
  );
}

/**
 * The gold band on top of the phone's bottom bar, while one more shop adds 1,000P or more: the
 * summary card is out of sight while the orders are added.
 */
export function NextShopBand({ gain }: { gain: number | null }) {
  return (
    <Collapse open={gain !== null} unmountOnExit>
      <Gold>
        <Flex wrap="wrap" align="center" columnGap="2.5" rowGap="0.5" px="4" py="1.5" fontSize="sm">
          <Flex as="b" align="center" gap="1.5" whiteSpace="nowrap">
            <SparklesIcon />
            {LABEL}
          </Flex>
          <Text as="span" whiteSpace="nowrap">
            あと1店舗で約{" "}
            <Text as="b" fontSize="md" fontVariantNumeric="tabular-nums">
              +{grouped(gain ?? 0)}P
            </Text>
          </Text>
        </Flex>
      </Gold>
    </Collapse>
  );
}
