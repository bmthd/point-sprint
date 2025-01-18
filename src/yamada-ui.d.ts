import { Column, RowData } from "@yamada-ui/table";
import NextLink from "next/link";
import { ComponentProps } from "react";

declare module "@yamada-ui/react" {
  interface LinkProps extends ComponentProps<typeof NextLink> {}
}

// このPRがマージされるまでの暫定対応
// https://github.com/yamada-ui/yamada-ui/pull/4321
declare module "@yamada-ui/table" {
  interface TableMeta<TData extends RowData> {}
  interface HeaderContext<TData, TValue> {
    /**
     * An instance of a column.
     */
    column: Column<TData, TValue>;
    /**
     * An instance of a header.
     */
    header: Header<TData, TValue>;
    /**
     * The table instance.
     */
    table: Table<TData>;
  }
}
