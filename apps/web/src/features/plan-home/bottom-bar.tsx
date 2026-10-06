import type { CalculationResult, Plan } from "@workspaces/domain";
import { Box, Button, Text } from "@workspaces/ui";
import { PlusIcon } from "./icons";
import { countedAmount, effectiveRate } from "./summary-card";

const num = (value: number) => value.toLocaleString("ja-JP");

/** The phone's bar fixed to the bottom of the screen: totals and the way to add an order. */
export function BottomBar({
  plan,
  result,
  onAdd,
}: {
  plan: Plan;
  result: CalculationResult;
  onAdd: () => void;
}) {
  const amount = countedAmount(plan);
  return (
    <Box
      aria-label="合計"
      role="region"
      position="fixed"
      insetX="0"
      bottom="0"
      zIndex="docked"
      bg="bg.panel"
      borderTopWidth="1px"
      borderColor="border"
      px="4"
      pt="2.5"
      pb="calc(18px + env(safe-area-inset-bottom))"
      display="flex"
      alignItems="center"
      gap="3"
    >
      <Box flex="1" display="flex" flexDirection="column" fontVariantNumeric="tabular-nums">
        <Text as="span" fontSize="xs" color="fg.muted">
          ¥{num(amount)}・{result.shopCount}店舗
        </Text>
        <Text as="span" fontSize="lg" fontWeight="bold">
          {num(result.total)}P{" "}
          <Text as="span" fontSize="sm" fontWeight="medium" color="fg.muted">
            {effectiveRate(result.total, amount)}%
          </Text>
        </Text>
      </Box>
      <Button colorScheme="primary" size="xl" onClick={onAdd} startIcon={<PlusIcon />}>
        注文を追加
      </Button>
    </Box>
  );
}
