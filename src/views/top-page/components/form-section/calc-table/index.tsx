"use client";
import { NumberField, TextField } from "@/ui/form";
import { Operation } from "@/ui/table";
import { FieldMetadata, FormMetadata } from "@conform-to/react";
import { GripVerticalIcon, StoreIcon, XIcon } from "@yamada-ui/lucide";
import { Button, IconButton, Input } from "@yamada-ui/react";
import { CellContext, Column, HeaderContext, Table, TableMeta } from "@yamada-ui/table";
import { FC, useCallback, useMemo } from "react";
import { Item, SPUEvent } from "../../../schema";
import { DetailButton } from "./detail-button";

/* Row Components */

type CellComponent<T> = FC<CellContext<FieldMetadata<T>, Operation<T>>>;

const DragHandle: FC = () => <IconButton icon={<GripVerticalIcon />} colorScheme="gray" p={0} />;

const ShopCountButton: CellComponent<Item> = ({ row }) => (
  <Button colorScheme={row.original.getFieldset().active ? "red" : "whiteAlpha"}>
    <StoreIcon />
    {row.original.getFieldset().active ? "○" : "×"}
  </Button>
);

const NameField: CellComponent<Item> = ({ row }) => {
  const field = row.original.getFieldset();
  return <TextField name={field.name.name} />;
};

const PriceField: CellComponent<Item> = ({ row }) => {
  const field = row.original.getFieldset();
  return <NumberField name={field.price.name} />;
};

const TaxRateField: CellComponent<Item> = ({ row }) => {
  const field = row.original.getFieldset();
  return <NumberField name={field.taxRate.name} />;
};

const AdditionalRateField: CellComponent<Item> = ({ row }) => {
  const field = row.original.getFieldset();
  return <NumberField name={field.additionalRate.name} />;
};

const TotalRowPointDisplay: CellComponent<Item> = ({ table }) => {
  const total = useMemo(() => {
    const data = table.options.data;
    return data.reduce((acc, row) => {
      const field = row.getFieldset();
      return acc + 0;
    }, 0);
  }, [table]);
  return <Input value={total} readOnly />;
};

const TotalRateDisplay: CellComponent<Item> = ({ table }) => {
  const total = useMemo(() => {
    const data = table.options.data;
    return data.reduce((acc, row) => {
      const field = row.getFieldset();
      return acc + 0;
    }, 0);
  }, [table]);
  return <Input value={total} readOnly />;
};

const DeleteButton: CellComponent<Item> = ({ table, row }) => {
  const handleClick = useCallback(() => table.options.meta?.remove?.(row.index), [table, row]);
  return <IconButton onClick={handleClick} icon={<XIcon />} colorScheme="danger" />;
};

/* Footer Components */
type HeaderComponent<T> = FC<HeaderContext<FieldMetadata<T>, Operation<T>>>;

const AddRowButton: HeaderComponent<Item> = ({ table }) => {
  const id = window.btoa(crypto.randomUUID());
  const handleClick = useCallback(() => table.options.meta?.add?.({ id }), [table]);
  return <Button onClick={handleClick}>追加</Button>;
};

const TotalPointDisplay: HeaderComponent<Item> = ({ table }) => {
  const total = useMemo(() => {
    const data = table.options.data;
    return data.reduce((acc, row) => {
      const field = row.getFieldset();
      return acc + 0;
    }, 0);
  }, [table]);
  return <Input value={total} readOnly />;
};

const AddAdditionalRateButton: HeaderComponent<Item> = ({ table }) => {
  const handleClick = useCallback(() => table.options.meta?.add?.(), [table]);
  return <Button onClick={handleClick}>追加</Button>;
};

/** Form操作用関数をまとめたオブジェクトへの安定した参照を提供する */
const useOperations = ({
  form,
  field,
}: { form: FormMetadata<SPUEvent>; field: FieldMetadata<Item[]> }): TableMeta<
  FieldMetadata<Item>
> => {
  const add = useCallback(
    (item?: Partial<Item>) => form.insert({ name: field.name, defaultValue: item }),
    [form, field],
  );
  const remove = useCallback(
    (index: number) => form.remove({ index, name: field.name }),
    [form, field],
  );
  const save = useCallback(() => {}, []);
  const move = useCallback((from: number, to: number) => {}, []);
  return useMemo(() => ({ add, remove, save, move }), [add, remove, save, move]);
};

export const CalcTable: FC<{ form: FormMetadata<SPUEvent>; field: FieldMetadata<Item[]> }> = ({
  form,
  field,
}) => {
  const data = useMemo(() => field.getFieldList(), [field]);

  const columns = useMemo<Column<FieldMetadata<Item>, Operation<Item>>[]>(
    () => [
      {
        id: "active",
        columns: [
          { header: "並び替え", cell: DragHandle },
          { header: "購入カウント", cell: ShopCountButton },
        ],
        footer: AddRowButton,
      },
      {
        id: "input-group",
        columns: [
          { header: "商品名", cell: NameField },
          { header: "価格", cell: PriceField },
          { header: "税率", cell: TaxRateField },
        ],
        footer: TotalPointDisplay,
      },
      {
        header: "追加還元",
        cell: AdditionalRateField,
        footer: AddAdditionalRateButton,
      },
      // {
      //   header: "キャンペーン",
      //   // cell: ({ row }) => <Box>{Object.keys(row.original.getFieldset().campaigns).join(",")}</Box>,
      // },
      { header: "合計ポイント", cell: TotalRowPointDisplay },
      { header: "合計倍率", cell: TotalRateDisplay },
      { header: "詳細", cell: DetailButton },
      { header: "削除", cell: DeleteButton },
    ],
    [],
  );

  const meta = useOperations({ form, field });

  return (
    <Table
      {...{ data, columns, meta }}
      withFooter
      enableRowSelection={false}
      headerProps={{ bg: "brand", textColor: "white" }}
      bg="white"
    />
  );
};
