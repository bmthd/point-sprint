import { Flex, type FlexProps } from "@workspaces/ui";

/**
 * The row a column of a two-column page starts with: the column's heading, with its buttons on
 * the right. The row is as tall as a button in every column, with buttons or without, so the
 * headings, and the cards under them, line up across the columns.
 */
export function ColumnHead(props: FlexProps) {
  return <Flex minH="11" align="center" justify="space-between" gap="2" {...props} />;
}
