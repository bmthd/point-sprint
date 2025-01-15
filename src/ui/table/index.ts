import { RowData } from "@yamada-ui/table";

export type Operation = {
  add?: () => void;
  remove?: (index: number) => void;
  save?: () => void;
};

declare module "@tanstack/table-core" {
  interface TableMeta<TData extends RowData> extends Operation {}
}
