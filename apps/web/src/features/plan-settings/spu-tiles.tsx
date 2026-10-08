import { type CalculationResult, type Plan } from "@workspaces/domain";
import { Badge, Box, Card, Text } from "@workspaces/ui";
import { useSetAtom } from "jotai";
import { ExternalIcon } from "../../icons";
import { SPU_PAGE_URL } from "../../rakuten/assets";
import { SpuTileGrid, enabledRate, spuRate } from "../../spu/tiles";
import { toggleBenefitAtom } from "../../state/order-ops";
import { useSaveSettingsChange } from "./settings-shared";

const num = (value: number) => Number(value.toFixed(2)).toLocaleString("ja-JP");

/** The plan's SPU section: a total, controls, and the common tile grid. */
export function SpuTiles({ plan, result }: { plan: Plan; result: CalculationResult }) {
  const toggle = useSetAtom(toggleBenefitAtom);
  const save = useSaveSettingsChange(plan.id);
  const capped = new Set(
    result.benefitTotals.filter((total) => total.capReached).map((total) => total.benefitId),
  );
  const normal = enabledRate(plan, "base");
  const spu = spuRate(plan);

  return (
    <Card.Root as="section" aria-label="SPU">
      <Card.Body alignItems="stretch">
        <Box display="flex" alignItems="flex-end" justifyContent="space-between" gap="3">
          <Box>
            <Text fontSize="xs" color="fg.muted">
              SPU を入れて全商品
            </Text>
            <Text
              fontSize="4xl"
              fontWeight="bold"
              lineHeight="1.1"
              fontVariantNumeric="tabular-nums"
            >
              {num(normal + spu)}
              <Text as="span" fontSize="md" fontWeight="medium">
                倍
              </Text>
            </Text>
          </Box>
          <Text fontSize="xs" color="fg.muted" textAlign="end" fontVariantNumeric="tabular-nums">
            通常 {num(normal)}倍 ＋ SPU{" "}
            <Text as="b" color="fg">
              +{num(spu)}倍
            </Text>
            <br />
            タップで ON / OFF
          </Text>
        </Box>
        <SpuTileGrid
          benefits={plan.benefits}
          capped={capped}
          onToggle={(benefitId) => save(toggle({ planId: plan.id, benefitId }))}
        />
        <Box
          display="flex"
          flexWrap="wrap"
          alignItems="center"
          columnGap="3"
          rowGap="1.5"
          fontSize="xs"
          color="fg.muted"
        >
          <Box as="span" display="inline-flex" alignItems="center" gap="1">
            <Box
              as="span"
              boxSize="3"
              rounded="sm"
              bg="primary.subtle"
              borderWidth="1px"
              borderColor="primary.muted"
            />{" "}
            ON
          </Box>
          <Box as="span" display="inline-flex" alignItems="center" gap="1">
            <Box as="span" boxSize="3" rounded="sm" borderWidth="1px" borderColor="border" /> OFF
          </Box>
          <Box as="span" display="inline-flex" alignItems="center" gap="1">
            <Badge as="span" colorScheme="primary" variant="solid" fullRounded>
              上限
            </Badge>{" "}
            このプランで上限に達した
          </Box>
          <Box as="span" ms="auto">
            名前を押すと上限・条件
          </Box>
        </Box>
        <Text
          as="a"
          href={SPU_PAGE_URL}
          target="_blank"
          rel="noreferrer"
          alignSelf="flex-start"
          fontSize="sm"
          color="link"
        >
          楽天で自分のSPUを確認する <ExternalIcon />
        </Text>
      </Card.Body>
    </Card.Root>
  );
}

export { spuRate };
