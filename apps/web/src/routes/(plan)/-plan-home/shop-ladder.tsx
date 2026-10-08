import type { ShopAroundOutlook, ShopAroundOutlookRow } from "@workspaces/domain";
import {
  Box,
  type BoxProps,
  Button,
  Heading,
  Progress,
  Text,
  VisuallyHidden,
} from "@workspaces/ui";
import { useId, useState } from "react";
import { ChevronIcon } from "../../../ui/icons";

/** The row of the current shop count; below the first tier that is the first row. */
export function currentRow(outlook: ShopAroundOutlook): ShopAroundOutlookRow | undefined {
  return outlook.rows.find((row) => row.shops === outlook.shopCount) ?? outlook.rows[0];
}

/** Yen as 万円 to one decimal, e.g. 245,000 → 24.5万円. */
export const manYen = (yen: number) => `${(yen / 10000).toFixed(1)}万円`;

const Th = (props: BoxProps) => (
  <Box as="th" fontWeight="normal" textAlign="start" px="2" pb="1" whiteSpace="nowrap" {...props} />
);
const Td = (props: BoxProps) => <Box as="td" px="2" py="1.5" {...props} />;

/**
 * 「あと何店舗回る？」: rate and remaining amount until the cap for each shop count from now up to
 * the top tier. `compact` (the phone's summary card) shows only the current row until expanded.
 */
export function ShopLadder({
  outlook,
  compact = false,
}: {
  outlook: ShopAroundOutlook;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tableId = useId();
  const current = currentRow(outlook);
  const rows = compact && !open ? outlook.rows.filter((row) => row === current) : outlook.rows;
  const longest = Math.max(1, ...outlook.rows.map((row) => row.remainingTaxExcluded ?? 0));

  return (
    <Box display="flex" flexDirection="column" gap="2">
      {compact ? (
        <Button
          variant="ghost"
          colorScheme="gray"
          size="lg"
          justifyContent="space-between"
          aria-expanded={open}
          aria-controls={tableId}
          onClick={() => setOpen(!open)}
        >
          あと何店舗回る？
          <ChevronIcon open={open} />
        </Button>
      ) : (
        <Heading as="h3" fontSize="sm">
          あと何店舗回る？
        </Heading>
      )}
      <Box
        as="table"
        id={tableId}
        w="full"
        fontSize="sm"
        fontVariantNumeric="tabular-nums"
        style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}
      >
        <Box as="thead" fontSize="xs" color="fg.muted">
          <tr>
            <Th>店舗数</Th>
            <Th>倍率</Th>
            <Th w="full">
              <VisuallyHidden>残額のグラフ</VisuallyHidden>
            </Th>
            <Th textAlign="end">上限までの残額</Th>
          </tr>
        </Box>
        <tbody>
          {rows.map((row) => {
            const isCurrent = row === current;
            const remaining = row.remainingTaxExcluded;
            return (
              <Box
                as="tr"
                key={row.shops}
                aria-current={isCurrent ? "true" : undefined}
                bg={isCurrent ? "primary.subtle" : undefined}
                outline={isCurrent ? "1px solid" : undefined}
                outlineColor="primary.outline"
                fontWeight={isCurrent ? "bold" : undefined}
              >
                <Td whiteSpace="nowrap">{row.shops}店舗</Td>
                <Td whiteSpace="nowrap">+{row.rate}倍</Td>
                <Td>
                  <Progress
                    value={((remaining ?? 0) / longest) * 100}
                    colorScheme={isCurrent ? "primary" : "gray"}
                    aria-hidden
                  />
                </Td>
                <Td textAlign="end" whiteSpace="nowrap">
                  {remaining === null ? "—" : `約${manYen(remaining)}`}
                </Td>
              </Box>
            );
          })}
        </tbody>
      </Box>
      <Text fontSize="xs" color="fg.muted">
        残額は税抜・概算。いまの買い物を含めた金額から差し引いています。
      </Text>
    </Box>
  );
}
