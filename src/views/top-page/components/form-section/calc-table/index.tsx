"use client";
import { NumberField, TextField } from "@/ui/form";
import { Operation } from "@/ui/table";
import { FieldMetadata, FormMetadata } from "@conform-to/react";
import { GripVerticalIcon, PlusIcon, StoreIcon } from "@yamada-ui/lucide";
import { Button, IconButton, Input } from "@yamada-ui/react";
import { CellContext, Column, Table } from "@yamada-ui/table";
import { FC, useMemo } from "react";
import { Item, SPUEvent } from "../../../schema";
import { DetailButton } from "./detail-button";

const DeleteButton: FC<CellContext<FieldMetadata<Item>, Operation>> = ({ table, row }) => (
  <Button onClick={() => table.options.meta?.remove?.(row.index)} colorScheme="danger">
    削除
  </Button>
);

const ShopCountButton: FC<CellContext<FieldMetadata<Item>, Operation>> = ({ row }) => (
  <Button colorScheme={row.original.getFieldset().active ? "red" : "whiteAlpha"}>
    <StoreIcon />
    {row.original.getFieldset().active ? "○" : "×"}
  </Button>
);

const DragHandle: FC = () => <IconButton icon={<GripVerticalIcon />} colorScheme="gray" p={0} />;

type HeaderContext<T, U> = CellContext<T, U>;

const AddRowButton: FC<HeaderContext<FieldMetadata<Item>, Operation>> = ({ table }) => (
  <Button onClick={table.options.meta?.add}>追加</Button>
);

const NameField: FC<CellContext<FieldMetadata<Item>, Operation>> = ({ row }) => (
  <TextField name={row.original.getFieldset().name.name} />
);

const PriceField: FC<CellContext<FieldMetadata<Item>, Operation>> = ({ row }) => (
  <NumberField name={row.original.getFieldset().price.name} />
);

const TaxRateField: FC<CellContext<FieldMetadata<Item>, Operation>> = ({ row }) => (
  <NumberField name={row.original.getFieldset().taxRate.name} />
);

const AdditionalRateField: FC<CellContext<FieldMetadata<Item>, Operation>> = ({ row }) => (
  <NumberField name={row.original.getFieldset().additionalRate.name} />
);

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

  const columns = useMemo<Column<FieldMetadata<Item>, Operation>[]>(
    () => [
      {
        id: "active",
        columns: [
          { header: "並び替え", cell: DragHandle },
          {
            header: "購入カウント",
            cell: ShopCountButton,
          },
        ],
        footer: AddRowButton,
      },
      {
        id: "input-group",
        columns: [
          {
            header: "商品名",
            cell: NameField,
          },
          {
            header: "価格",
            cell: PriceField,
          },
          {
            header: "税率",
            cell: TaxRateField,
          },
        ],
        footer: () => <Input readOnly>合計</Input>,
      },
      {
        header: "追加還元",
        cell: AdditionalRateField,
        footer: () => <IconButton icon={<PlusIcon />} />,
      },
      {
        header: "キャンペーン",
        // cell: ({ row }) => <Box>{Object.keys(row.original.getFieldset().campaigns).join(",")}</Box>,
      },
      { header: "合計倍率", cell: () => <Input readOnly /> },
      { header: "詳細", cell: DetailButton },
      {
        header: "削除",
        cell: DeleteButton,
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
