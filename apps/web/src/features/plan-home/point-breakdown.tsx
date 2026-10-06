import { POINT_GROUPS, type PointGroup } from "@workspaces/domain";
import { Box, List, Text } from "@workspaces/ui";

const labels: Record<PointGroup, string> = {
  base: "通常",
  spu: "SPU",
  marathon: "マラソン",
  campaign: "キャンペーン",
};

/** Campaign points are always drawn hatched on the panel, so they never rely on color alone. */
export const pointFill = (group: PointGroup, stripe: number) =>
  group === "campaign"
    ? `repeating-linear-gradient(45deg, {colors.point.campaign} 0 ${stripe}px, {colors.bg.panel} ${stripe}px ${stripe * 2}px)`
    : group === "base"
      ? "point"
      : `point.${group}`;

/**
 * The four point groups as a stacked bar and a legend, always in the order 通常 → SPU → マラソン →
 * キャンペーン. The legend is a two-column grid, or one wrapping line for a table's expanded row.
 */
export function PointBreakdown({
  totals,
  legend = "grid",
}: {
  totals: Record<PointGroup, number>;
  legend?: "grid" | "line";
}) {
  const sum = POINT_GROUPS.reduce((total, group) => total + totals[group], 0);
  return (
    <Box display="flex" flexDirection="column" gap="2.5">
      <Box
        display="flex"
        h="3.5"
        rounded="lg"
        overflow="hidden"
        gap="0.5"
        bg={sum > 0 ? undefined : "bg.muted"}
        aria-hidden
      >
        {sum > 0
          ? POINT_GROUPS.filter((group) => totals[group] > 0).map((group) => (
              <Box key={group} w={`${(totals[group] / sum) * 100}%`} bg={pointFill(group, 3)} />
            ))
          : null}
      </Box>
      <List.Root
        aria-label="ポイントの内訳"
        display={legend === "grid" ? "grid" : "flex"}
        flexDirection="row"
        flexWrap="wrap"
        gridTemplateColumns="repeat(2, minmax(0, 1fr))"
        rowGap={legend === "grid" ? "1.5" : "1"}
        columnGap={legend === "grid" ? "3" : "4"}
        fontSize="sm"
      >
        {POINT_GROUPS.map((group) => (
          <List.Item key={group} display="flex" alignItems="center" gap="1.5">
            <Box boxSize="2.5" rounded="xs" flex="none" bg={pointFill(group, 2)} />
            {labels[group]}
            <Text
              as="span"
              ms={legend === "grid" ? "auto" : undefined}
              fontWeight={legend === "grid" ? undefined : "bold"}
              fontVariantNumeric="tabular-nums"
            >
              {totals[group].toLocaleString("ja-JP")}P
            </Text>
          </List.Item>
        ))}
      </List.Root>
    </Box>
  );
}
