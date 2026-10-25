import { Flex, type FlexProps } from "@workspaces/ui";

/** How tall the row is, for what lines up with the cards under it. */
export const COLUMN_HEAD_HEIGHT = "{sizes.11}";

/**
 * The row a column of a two-column page starts with: the column's heading, with its buttons on
 * the right. The row is as tall as a button in every column, with buttons or without, so the
 * headings, and the cards under them, line up across the columns.
 */
export function ColumnHead(props: FlexProps) {
  return (
    <Flex minH={COLUMN_HEAD_HEIGHT} align="center" justify="space-between" gap="2" {...props} />
  );
}
