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
/** A cell; `fold` lets it fold to no height while the compact ladder is closed. */
const Td = ({ fold = false, children, ...props }: TdProps & { fold?: boolean }) =>
  fold ? (
    <NativeTable.Td px="2" py="0" whiteSpace="nowrap" borderWidth="0" {...props}>
      <Box display="grid" transitionDuration="slow" transitionProperty="grid-template-rows">
        <Box overflowY="clip" minH="0">
          <Box py="1.5">{children}</Box>
        </Box>
      </Box>
    </NativeTable.Td>
  ) : (
    <NativeTable.Td px="2" py="1.5" whiteSpace="nowrap" borderWidth="0" {...props}>
      {children}
    </NativeTable.Td>
  );

/** While the compact ladder's details are closed, its folding rows have no height and are hidden. */
const folding = {
  "& [data-fold]": {
    visibility: "hidden",
    transitionDuration: "slow",
    transitionProperty: "visibility",
  },
  "& [data-fold] > td > div": { gridTemplateRows: "0fr" },
  "&:has(details[open]) [data-fold]": { visibility: "visible" },
  "&:has(details[open]) [data-fold] > td > div": { gridTemplateRows: "1fr" },
};

/**
 * 「あと何店舗回る？」: for each shop count from now up to the top tier, the rate, how full the cap
 * gets with the current basket, and the amount still to buy to fill it. `compact` (the phone's summary card) shows only the current row, the first one, and
 * unfolds the others under it in the same table.
 */
export function ShopLadder({
  outlook,
  compact = false,
}: {
  outlook: ShopAroundOutlook;
  compact?: boolean;
}) {
  const current = currentRow(outlook);
  const { cap } = outlook;
  // Without a cap, the bars compare with the row that earns the most.
  const scale = cap ?? Math.max(1, ...outlook.rows.map((row) => row.points));

  return (
    <Flex direction="column" gap="2" css={compact ? folding : undefined}>
      <Heading as="h3" fontSize="sm">
        あと何店舗回る？
      </Heading>
      <NativeTable.Root fontSize="sm" fontVariantNumeric="tabular-nums">
        <NativeTable.Thead fontSize="xs" color="fg.muted">
          <NativeTable.Tr>
            <Th>店舗数</Th>
            <Th>倍率</Th>
            <Th w="full">
              {cap === null ? (
                <VisuallyHidden>もらえるポイントのグラフ</VisuallyHidden>
              ) : (
                `上限 ${cap.toLocaleString("ja-JP")}P まで`
              )}
            </Th>
            <Th textAlign="end">あと</Th>
          </NativeTable.Tr>
        </NativeTable.Thead>
        <NativeTable.Tbody>
          {outlook.rows.map((row, index) => {
            const isCurrent = row === current;
            const remaining = row.remainingTaxExcluded;
            const full = cap !== null && row.points >= cap;
            const fold = compact && index > 0;
            return (
              <NativeTable.Tr
                key={row.shops}
                data-fold={fold ? "" : undefined}
                aria-current={isCurrent ? "true" : undefined}
                bg={isCurrent ? "primary.subtle" : undefined}
                outline={isCurrent ? "1px solid" : undefined}
                outlineColor="primary.outline"
                outlineOffset="-1px"
                fontWeight={isCurrent ? "bold" : undefined}
              >
                <Td fold={fold}>{row.shops}店舗</Td>
                <Td fold={fold}>+{row.rate}倍</Td>
                <Td fold={fold} verticalAlign="middle">
                  <Progress
                    value={(row.points / scale) * 100}
                    colorScheme={full ? "success" : isCurrent ? "primary" : "gray"}
                    aria-hidden
                  />
                </Td>
                <Td fold={fold} textAlign="end">
                  {full ? "上限" : remaining === null ? "—" : `約${manYen(remaining)}`}
                </Td>
              </NativeTable.Tr>
            );
          })}
        </NativeTable.Tbody>
      </NativeTable.Root>
      {compact ? (
        <NativeAccordion.Root>
          <NativeAccordion.Item borderWidth="0">
            <NativeAccordion.Button fontSize="sm" fontWeight="bold" px="2">
              ほかの店舗数を見る
            </NativeAccordion.Button>
            {/* The rows unfold in the table above; an empty panel must not add its open padding. */}
            <NativeAccordion.Panel _groupOpen={{ pb: "0" }} />
          </NativeAccordion.Item>
        </NativeAccordion.Root>
      ) : null}
      <Text fontSize="xs" color="fg.muted">
        残額は税抜・概算。いまの買い物を含めた金額から差し引いています。
      </Text>
    </Flex>
  );
}
