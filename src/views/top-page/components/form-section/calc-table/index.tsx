"use client";
import { Operation } from "@/ui/table";
import { FieldMetadata, FormMetadata } from "@conform-to/react";
import { type Column, type Row, Table, type TableMeta } from "@yamada-ui/table";
import { FC, useCallback, useMemo } from "react";
import { Item, SPUEvent } from "../../../schema";
import { AddAdditionalRateButton, AddRowButton, ResetButton, TotalPointDisplay } from "./footer";
import {
  AdditionalRateField,
  DeleteButton,
  DetailButton,
  DragHandle,
  NameField,
  PriceField,
  ShopCountButton,
  TaxRateField,
  TotalRateDisplay,
  TotalRowPointDisplay,
} from "./row";

/** Form操作用関数をまとめたオブジェクトへの安定した参照を提供する */
const useOperations = ({
  form,
  field,
}: { form: FormMetadata<SPUEvent>; field: FieldMetadata<Item[]> }): TableMeta<
  FieldMetadata<Item>
> => {
  const add = useCallback(
    (item?: Partial<Item>): void => form.insert({ name: field.name, defaultValue: item }),
    [form, field],
  );
  const remove = useCallback(
    (index: number): void => form.remove({ index, name: field.name }),
    [form, field],
  );
  const save = useCallback(() => {}, []);
  const move = useCallback((from: number, to: number) => {}, []);
  const reset = useCallback(() => form.reset({ name: field.name }), [form, field]);
  return useMemo(() => ({ add, remove, save, move }), [add, remove, save, move, reset]);
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
      {
        id: "button-group",
        columns: [
          { header: "詳細", cell: DetailButton },
          { header: "削除", cell: DeleteButton },
        ],
        footer: ResetButton,
      },
    ],
    [],
  );

  const meta = useOperations({ form, field });

  const rowProps = useCallback(
    (row: Row<FieldMetadata<Item>>) => ({ 
      // disabled: !row.original.getFieldset().active.value
     }),
    [],
  );

  return (
    <Table
      {...{ data, columns, meta, rowProps }}
      withFooter
      enableRowSelection={false}
      headerProps={{ bg: "brand", textColor: "white" }}
      bg="white"
      size="sm"
    />
  );
};
