import { grouped } from "../../../ui/format";
import { POINT_GROUPS, type PointGroup } from "@workspaces/domain";
import { Box, Flex, List, Text } from "@workspaces/ui";

const labels: Record<PointGroup, string> = {
  base: "通常",
  spu: "SPU",
  marathon: "マラソン",
  campaign: "キャンペーン",
};

/** Campaign points are always drawn hatched on the panel, so they never rely on color alone. */
export function pointFill(group: PointGroup, stripe: number) {
  return group === "campaign"
    ? `repeating-linear-gradient(45deg, {colors.point.campaign} 0 ${stripe}px, {colors.bg.panel} ${stripe}px ${stripe * 2}px)`
    : group === "base"
      ? "point"
      : `point.${group}`;
}

/**
 * The four point groups as a stacked bar and a legend, always in the order 通常 → SPU → マラソン →
 * キャンペーン. The legend is a two-column grid, or one wrapping line for a table's expanded row.
 */
export function PointBreakdown({
  totals,
  legend = "grid",
  held = false,
}: {
  totals: Record<PointGroup, number>;
  legend?: "grid" | "line";
  /** A held order's points, the ones it would get once counted: faded, and struck through. */
  held?: boolean;
}) {
  const sum = POINT_GROUPS.reduce((total, group) => total + totals[group], 0);
  return (
    <Flex direction="column" gap="2.5">
      <Flex
        h="3.5"
        rounded="lg"
        overflow="hidden"
        gap="0.5"
        bg={sum > 0 ? undefined : "bg.muted"}
        opacity={held ? 0.4 : undefined}
        aria-hidden
      >
        {sum > 0
          ? POINT_GROUPS.filter((group) => totals[group] > 0).map((group) => (
              <Box key={group} w={`${(totals[group] / sum) * 100}%`} bg={pointFill(group, 3)} />
            ))
          : null}
      </Flex>
      <List.Root
        aria-label={held ? "購入決定にしたときの内訳" : "ポイントの内訳"}
        display={legend === "grid" ? "grid" : "flex"}
        flexDirection="row"
        flexWrap="wrap"
        gridTemplateColumns="repeat(2, minmax(0, 1fr))"
        rowGap={legend === "grid" ? "1.5" : "1"}
        columnGap={legend === "grid" ? "3" : "4"}
        fontSize="sm"
        color={held ? "fg.muted" : undefined}
      >
        {POINT_GROUPS.map((group) => (
          <List.Item key={group} display="flex" alignItems="center" gap="1.5">
            <Box
              boxSize="2.5"
              rounded="xs"
              flex="none"
              bg={pointFill(group, 2)}
              opacity={held ? 0.4 : undefined}
            />
            {labels[group]}
            <Text
              as={held ? "s" : "span"}
              ms={legend === "grid" ? "auto" : undefined}
              fontWeight={legend === "grid" ? undefined : "bold"}
              fontVariantNumeric="tabular-nums"
            >
              {grouped(totals[group])}P
            </Text>
          </List.Item>
        ))}
      </List.Root>
    </Flex>
  );
}
