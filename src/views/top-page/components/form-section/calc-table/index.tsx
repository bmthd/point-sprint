"use client";
import { type Operation } from "@/ui/table";
import type { FieldMetadata, FormMetadata } from "@conform-to/react";
import { A, D, pipe } from "@mobily/ts-belt";
import { type Column, type Row, Table, type TableMeta } from "@yamada-ui/table";
import { type FC, RefObject, useCallback, useMemo, useRef } from "react";
import { type Item, type SPUEventInput } from "../../../schema/storage";
import {
  AddAdditionalRateButton,
  AddRowButton,
  ResetButton,
  TotalPointDisplay,
  TotalPriceDisplay,
} from "./footer";
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

/** TableコンポーネントへのDI用にForm操作用関数をまとめたオブジェクトへの安定した参照を提供する */
const useOperations = ({
  form,
  field,
}: {
  form: FormMetadata<SPUEventInput>;
  field: FieldMetadata<Item[]>;
  ref: RefObject<HTMLTableElement | null>;
}): TableMeta<FieldMetadata<Item>> => {
  const add = useCallback(
    (item?: Partial<Item>): void => form.insert({ name: field.name, defaultValue: item }),
    [form, field],
  );
  const remove = useCallback(
    (index: number): void => form.remove({ index, name: field.name }),
    [form, field],
  );
  const move = useCallback(
    (from: number, to: number) => form.reorder({ name: field.name, from, to }),
    [],
  );
  const reset = useCallback(() => {
    // field.getFieldList().forEach((field) => {
    //   pipe(
    //     field.getFieldset(),
    //     D.toPairs,
    //     A.forEach(([key, field]) => {
    //       form.update({
    //         name: field.name as string,
    //         value: initializeItem()[key as keyof Item] as any,
    //       });
    //     }),
    //   );
    // });
    pipe(
      field.getFieldList(),
      A.forEach((field) => {
        pipe(
          field.getFieldset(),
          D.values,
          A.forEach((field) => {
            // form.update({
            //   name: field.name as string,
            //   value: initializeItem()[key as keyof Item] as any,
            // });
            form.reset({ name: field.name as string });
          }),
        );
      }),
    );
  }, [form, field]);
  return useMemo(() => ({ add, remove, move }), [add, remove, move, reset]);
};

export const CalcTable: FC<{ form: FormMetadata<SPUEventInput>; field: FieldMetadata<Item[]> }> = ({
  form,
  field,
}) => {
  const ref = useRef<HTMLTableElement>(null);
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
        footer: TotalPriceDisplay,
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
      {
        id: "result-group",
        columns: [
          { header: "合計ポイント", cell: TotalRowPointDisplay },
          { header: "合計倍率", cell: TotalRateDisplay },
        ],
        footer: TotalPointDisplay,
      },
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

  const meta = useOperations({ form, field, ref });

  const rowProps = useCallback(
    (row: Row<FieldMetadata<Item>>) => ({
      // disabled: !row.original.getFieldset().active.value
    }),
    [],
  );

  const getRowId = useCallback(
    (field: FieldMetadata<Item>, index: number) => field.getFieldset().id.value ?? index.toString(),
    [],
  );

  return (
    <Table
      ref={ref}
      {...{ data, columns, meta, rowProps, getRowId }}
      withFooter
      enableRowSelection={false}
      headerProps={{ bg: "brand", textColor: "white" }}
      bg="white"
    />
  );
};
