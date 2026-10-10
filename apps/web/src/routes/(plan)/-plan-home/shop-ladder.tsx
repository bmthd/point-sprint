import type { ShopAroundOutlook, ShopAroundOutlookRow } from "@workspaces/domain";
import {
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
const Td = (props: TdProps) => (
  <NativeTable.Td px="2" py="1.5" whiteSpace="nowrap" borderWidth="0" {...props} />
);

/**
 * 「あと何店舗回る？」: rate and remaining amount until the cap for each shop count from now up to
 * the top tier. `compact` (the phone's summary card) shows only the current row, the first one, and
 * opens the others below it.
 */
export function ShopLadder({
  outlook,
  compact = false,
}: {
  outlook: ShopAroundOutlook;
  compact?: boolean;
}) {
  const [first, ...others] = outlook.rows;

  return (
    <Flex direction="column" gap="2">
      <Heading as="h3" fontSize="sm">
        あと何店舗回る？
      </Heading>
      {compact && first ? (
        <>
          <LadderTable outlook={outlook} shown={[first]} />
          <NativeAccordion.Root>
            <NativeAccordion.Item borderWidth="0">
              <NativeAccordion.Button fontSize="sm" fontWeight="bold" px="2">
                ほかの店舗数を見る
              </NativeAccordion.Button>
              <NativeAccordion.Panel px="0">
                <LadderTable outlook={outlook} shown={others} head={false} />
              </NativeAccordion.Panel>
            </NativeAccordion.Item>
          </NativeAccordion.Root>
        </>
      ) : (
        <LadderTable outlook={outlook} shown={outlook.rows} />
      )}
      <Text fontSize="xs" color="fg.muted">
        残額は税抜・概算。いまの買い物を含めた金額から差し引いています。
      </Text>
    </Flex>
  );
}

/**
 * The ladder's table, showing the `shown` rows. Every row is laid out, the rest collapsed, so the
 * tables the compact ladder splits into share their column widths.
 */
function LadderTable({
  outlook,
  shown,
  head = true,
}: {
  outlook: ShopAroundOutlook;
  shown: ShopAroundOutlookRow[];
  head?: boolean;
}) {
  const current = currentRow(outlook);
  const longest = Math.max(1, ...outlook.rows.map((row) => row.remainingTaxExcluded ?? 0));

  return (
    <NativeTable.Root
      fontSize="sm"
      fontVariantNumeric="tabular-nums"
      style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}
    >
      <NativeTable.Thead fontSize="xs" color="fg.muted">
        <NativeTable.Tr visibility={head ? undefined : "collapse"}>
          <Th>店舗数</Th>
          <Th>倍率</Th>
          <Th w="full">
            <VisuallyHidden>残額のグラフ</VisuallyHidden>
          </Th>
          <Th textAlign="end">上限までの残額</Th>
        </NativeTable.Tr>
      </NativeTable.Thead>
      <NativeTable.Tbody>
        {outlook.rows.map((row) => {
          const isCurrent = row === current;
          const remaining = row.remainingTaxExcluded;
          return (
            <NativeTable.Tr
              key={row.shops}
              visibility={shown.includes(row) ? undefined : "collapse"}
              aria-current={isCurrent ? "true" : undefined}
              bg={isCurrent ? "primary.subtle" : undefined}
              outline={isCurrent ? "1px solid" : undefined}
              outlineColor="primary.outline"
              fontWeight={isCurrent ? "bold" : undefined}
            >
              <Td>{row.shops}店舗</Td>
              <Td>+{row.rate}倍</Td>
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
