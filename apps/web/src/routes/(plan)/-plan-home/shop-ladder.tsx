import type { ShopAroundOutlook, ShopAroundOutlookRow } from "@workspaces/domain";
import {
  Box,
  Flex,
  Heading,
  NativeAccordion,
  NativeTable,
  Progress,
  Text,
  type TdProps,
  type ThProps,
  VisuallyHidden,
} from "@workspaces/ui";
import { useState } from "react";

/** The row of the current shop count; below the first tier that is the first row. */
export function currentRow(outlook: ShopAroundOutlook): ShopAroundOutlookRow | undefined {
  return outlook.rows.find((row) => row.shops === outlook.shopCount) ?? outlook.rows[0];
}

/** Yen as 万円 to one decimal, e.g. 245,000 → 24.5万円. */
export const manYen = (yen: number) => `${(yen / 10000).toFixed(1)}万円`;

const Th = (props: ThProps) => (
  <NativeTable.Th
    fontWeight="normal"
    textAlign="start"
    px="2"
    pt="0"
    pb="1"
    whiteSpace="nowrap"
    borderWidth="0"
    {...props}
  />
);
const Td = (props: TdProps) => (
  <NativeTable.Td px="2" py="1.5" whiteSpace="nowrap" borderWidth="0" {...props} />
);

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
  const current = currentRow(outlook);

  return (
    <Flex direction="column" gap="2">
      {compact ? (
        <>
          <NativeAccordion.Root animate={false}>
            <NativeAccordion.Item
              borderWidth="0"
              onToggle={(event) => setOpen(event.currentTarget.open)}
            >
              <NativeAccordion.Button fontSize="sm" fontWeight="bold">
                あと何店舗回る？
              </NativeAccordion.Button>
              {/* The rows live in the table below; an empty panel must not add its open padding. */}
              <NativeAccordion.Panel _groupOpen={{ pb: "0" }} />
            </NativeAccordion.Item>
          </NativeAccordion.Root>
          {/* Outside the panel, so the current row stays put and the other rows open around it. */}
          <LadderTable
            outlook={outlook}
            rows={open ? outlook.rows : outlook.rows.filter((row) => row === current)}
          />
        </>
      ) : (
        <>
          <Heading as="h3" fontSize="sm">
            あと何店舗回る？
          </Heading>
          <LadderTable outlook={outlook} rows={outlook.rows} />
        </>
      )}
      <Text fontSize="xs" color="fg.muted">
        残額は税抜・概算。いまの買い物を含めた金額から差し引いています。
      </Text>
    </Flex>
  );
}

/** The ladder's table; `rows` may be a subset of the outlook's, laid out as if all were shown. */
function LadderTable({
  outlook,
  rows,
}: {
  outlook: ShopAroundOutlook;
  rows: ShopAroundOutlookRow[];
}) {
  const current = currentRow(outlook);
  const longest = Math.max(1, ...outlook.rows.map((row) => row.remainingTaxExcluded ?? 0));
  // Wide enough for the longest label of every row, so opening the compact table does not move the columns.
  const digits = (pick: (row: ShopAroundOutlookRow) => number) =>
    Math.max(...outlook.rows.map((row) => String(pick(row)).length));
  const shopsWidth = `calc(${digits((row) => row.shops)}ch + 2em)`;
  const rateWidth = `calc(${digits((row) => row.rate) + 1}ch + 1em)`;

  return (
    <NativeTable.Root
      fontSize="sm"
      fontVariantNumeric="tabular-nums"
      style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}
    >
      <NativeTable.Thead fontSize="xs" color="fg.muted">
        <NativeTable.Tr>
          <Th>店舗数</Th>
          <Th>倍率</Th>
          <Th w="full">
            <VisuallyHidden>残額のグラフ</VisuallyHidden>
          </Th>
          <Th textAlign="end">上限までの残額</Th>
        </NativeTable.Tr>
      </NativeTable.Thead>
      <NativeTable.Tbody>
        {rows.map((row) => {
          const isCurrent = row === current;
          const remaining = row.remainingTaxExcluded;
          return (
            <NativeTable.Tr
              key={row.shops}
              aria-current={isCurrent ? "true" : undefined}
              bg={isCurrent ? "primary.subtle" : undefined}
              outline={isCurrent ? "1px solid" : undefined}
              outlineColor="primary.outline"
              fontWeight={isCurrent ? "bold" : undefined}
            >
              <Td>
                <Box minW={shopsWidth}>{row.shops}店舗</Box>
              </Td>
              <Td>
                <Box minW={rateWidth}>+{row.rate}倍</Box>
              </Td>
              <Td>
                <Progress
                  value={((remaining ?? 0) / longest) * 100}
                  colorScheme={isCurrent ? "primary" : "gray"}
                  aria-hidden
                />
              </Td>
              <Td textAlign="end">{remaining === null ? "—" : `約${manYen(remaining)}`}</Td>
            </NativeTable.Tr>
          );
        })}
      </NativeTable.Tbody>
    </NativeTable.Root>
  );
}
