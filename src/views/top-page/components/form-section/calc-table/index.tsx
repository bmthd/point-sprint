"use client";
import { NumberField, TextField } from "@/ui/form";
import { FieldMetadata, FormMetadata } from "@conform-to/react";
import { PlusIcon, StoreIcon } from "@yamada-ui/lucide";
import { Box, Button, IconButton, Input } from "@yamada-ui/react";
import { Column, RowData, Table } from "@yamada-ui/table";
import { FC, useMemo } from "react";
import { Item, SPUEvent } from "../../../schema";
import { DetailButton } from "./detail-button";

type Operation = {
  add?: () => void;
  remove?: (index: number) => void;
  save?: () => void;
};

declare module "@tanstack/table-core" {
  interface TableMeta<TData extends RowData> extends Operation {}
}

export const CalcTable: FC<{ form: FormMetadata<SPUEvent>; field: FieldMetadata<Item[]> }> = ({
  form,
  field,
}) => {
  const operations = {
    add: () => form.insert({ name: field.name }),
    remove: (index: number) => form.remove({ index, name: field.name }),
    save: () => {},
  } satisfies Operation;

  const data = field.getFieldList();

  const columns = useMemo<Column<ReturnType<typeof field.getFieldList>[number], Operation>[]>(
    () => [
      {
        id: "active",
        columns: [
          { header: "並び替え", cell: ({ row }) => <Box>{row.index}</Box> },
          {
            header: "購入カウント",
            cell: ({ row }) => (
              <Button colorScheme={row.original.getFieldset().active ? "red" : "whiteAlpha"}>
                <StoreIcon />
                {row.original.getFieldset().active ? "○" : "×"}
              </Button>
            ),
          },
        ],
        footer: ({ table }) => <Button onClick={table.options.meta?.add}>追加</Button>,
      },
      {
        id: "input-group",
        columns: [
          {
            header: "商品名",
            cell: ({ row }) => <TextField name={row.original.getFieldset().name.name} />,
          },
          {
            header: "価格",
            cell: ({ row }) => <NumberField name={row.original.getFieldset().price.name} />,
          },
          {
            header: "税率",
            cell: ({ row }) => <NumberField name={row.original.getFieldset().taxRate.name} />,
          },
        ],
        footer: () => <Input readOnly>合計</Input>,
      },
      {
        header: "追加還元",
        cell: ({ row }) => <NumberField name={row.original.getFieldset().additionalRate.name} />,
        footer: () => <IconButton icon={<PlusIcon />} />,
      },
      {
        header: "キャンペーン",
        // cell: ({ row }) => <Box>{Object.keys(row.original.getFieldset().campaigns).join(",")}</Box>,
      },
      { header: "合計倍率", cell: () => <Input readOnly /> },
      {
        header: "同一店舗",
        cell: ({ row }) => <Box>{row.original.getFieldset().sameStore.value ? "○" : "×"}</Box>,
      },
      { header: "詳細", cell: () => <DetailButton /> },
      {
        header: "削除",
        cell: ({ table, row }) => (
          <Button onClick={() => table.options.meta?.remove?.(row.index)} colorScheme="danger">
            削除
          </Button>
        ),
      },
    ],
    [],
  );
  return (
    <Table
      {...{ data, columns }}
      meta={operations}
      enableRowSelection={false}
      headerProps={{ bg: "brand", textColor: "white" }}
      bg="white"
    />
  );
};
