import { useAtomValue } from "jotai";
import { planAtom, planResultAtom, bigOneMoreShopGainAtom } from "#/state/derived.ts";
import { useToday } from "#/routes/-use-today.ts";
import { Box, Flex, Button, Text, PlusIcon } from "@workspaces/ui";
import { grouped } from "#/ui/format.ts";
import { NextShopBand } from "./one-more-shop.tsx";
import { countedAmount, effectiveRate } from "./summary-card.tsx";

const now = () => new Date();

/** The phone's bar fixed to the bottom of the screen: totals and the way to add an order. */
export function BottomBar({ planId, onAdd }: { planId: string; onAdd: () => void }) {
  const plan = useAtomValue(planAtom(planId));
  const result = useAtomValue(planResultAtom(planId));
  const today = useToday(now);
  const oneMoreShopGain = useAtomValue(bigOneMoreShopGainAtom({ planId, today }));
  if (!plan || !result) return null;
  const amount = countedAmount(plan);
  return (
    <Box
      aria-label="合計"
      role="region"
      data-bottom-bar
      position="fixed"
      insetX="0"
      bottom="0"
      zIndex="kurillin"
      bg="bg.panel"
      borderTopWidth="1px"
      borderColor="border"
    >
      <NextShopBand gain={oneMoreShopGain} />
      <Flex px="4" pt="2.5" pb="calc(18px + env(safe-area-inset-bottom))" align="center" gap="3">
        <Flex flex="1" direction="column" fontVariantNumeric="tabular-nums">
          <Text as="span" fontSize="xs" color="fg.muted">
            ¥{grouped(amount)}・{result.shopCount}店舗
          </Text>
          <Text as="span" fontSize="lg" fontWeight="bold">
            {grouped(result.total)}P{" "}
            <Text as="span" fontSize="sm" fontWeight="medium" color="fg.muted">
              {effectiveRate(result.total, amount)}%
            </Text>
          </Text>
        </Flex>
        <Button colorScheme="primary" size="xl" onClick={onAdd} startIcon={<PlusIcon />}>
          注文を追加
        </Button>
      </Flex>
    </Box>
  );
}
